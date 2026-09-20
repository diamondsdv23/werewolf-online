const NIGHT_STATE = {
  idle: 'idle',
  calling: 'calling', // host กำลังเรียก role นี้อยู่
  waiting: 'waiting', // host รอให้ role ครบ action
  done: 'done', // ครบแล้ว host จะไปต่อ
}

const NIGHT_ORDER_DEFAULT = [
  'cupid', // คืนแรกเท่านั้น (ถ้ามี)
  'werewolf',
  'wolf_cub',
  'sorceress',
  'seer',
  'aura_seer',
  'doctor',
  'bodyguard',
  'witch',
  'cursed',
]

function nightRef(code) {
  return db.ref('rooms/' + code + '/night')
}

function metaNightRef(code) {
  return db.ref('rooms/' + code + '/meta')
}

function wolfActionsRef(code) {
  // wolf picks เก็บที่ rooms/$code/wolf (ตรง security rules ที่ publish อยู่แล้ว:
  // .read/.write = werewolf + host) → ไม่ต้องแก้ rules/ไม่ต้อง publish ใหม่
  return db.ref('rooms/' + code + '/wolf')
}

// ===================== HOST =====================

async function hostStartNight(code) {
  const r = roomRef(code)
  const snap = await r.once('value')
  const data = snap.val() || {}
  const meta = data.meta || {}
  const players = data.players || {}
  const playerList = Object.entries(players)

  const nightIndex = (meta.nightIndex || 0) + 1

  const updates = {}
  updates['meta/phase'] = 'night'
  updates['meta/nightIndex'] = nightIndex
  updates['meta/hostCall'] = ''
  updates['meta/wolfConfirmed'] = null
  updates['meta/nightResult'] = null
  updates['meta/hunterReveal'] = null

  // wolf picks เก็บที่ top-level wolf node (host + werewolf เขียนได้ตาม rules)
  updates['wolf'] = {}
  updates['meta/hostCall'] = ''
  updates['meta/wolfConfirmed'] = null
  updates['meta/nightResult'] = null
  updates['meta/hunterReveal'] = null

    const role = getRole(p.role)
    if (!role) continue
    if (p.role === 'werewolf' || p.role === 'wolf_cub' || p.role === 'sorceress') {
      wolfTeammates.push(uid)
    }
    if (p.role === 'cursed' && p.cursedStatus === 'wolf') {
      wolfTeammates.push(uid)
    }
  }
  updates['meta/wolfTeammates'] = wolfTeammates

  // night order (เฉพาะ role ที่มีในห้อง + คืนแรกถึงเรียก cupid)
  const order = NIGHT_ORDER_DEFAULT.filter((roleId) => {
    if (roleId === 'cupid' && nightIndex !== 1) return false
    const role = getRole(roleId)
    if (!role) return false
    return playerList.some(([, p]) => p.role === roleId)
  })
  updates['meta/nightOrder'] = order
  updates['meta/nightStep'] = 0

  await r.update(updates)
  return nightIndex
}

// host เรียก role ถัดไปตามลำดับ
async function hostCallNextRole(code) {
  const r = roomRef(code)
  const snap = await r.once('value')
  const data = snap.val() || {}
  const meta = data.meta || {}
  const order = meta.nightOrder || []
  const step = meta.nightStep || 0

  if (step >= order.length) {
    // เรียกครบทุก role แล้ว → host กดจบกลางคืน
    await r.update({ 'meta/hostCall': 'DONE' })
    return null
  }

  const roleId = order[step]
  await r.update({
    'meta/hostCall': roleId,
    'meta/nightStep': step + 1,
  })
  return roleId
}

// host ดู wolf picks เรียลไทม์ (ใช้ใน host-control.js .on)
// wolf: night/wolf/$uid/{target}

async function hostConfirmWolf(code, targetUid) {
  const r = roomRef(code)
  await r.update({
    'meta/wolfConfirmed': targetUid,
    'meta/hostCall': '', // จบขั้น wolf
  })
}

async function hostFinishNight(code) {
  const r = roomRef(code)
  const snap = await r.once('value')
  const data = snap.val() || {}
  const meta = data.meta || {}
  const players = data.players || {}
  const night = data.night || {}
  const wolfPicks = (data.wolf || {}) // wolf picks เก็บที่ top-level wolf node (อ่านจาก data.wolf ไม่ใช่ night.wolf)
  const confirmed = meta.wolfConfirmed
  const nightIndex = meta.nightIndex || 0

  const dead = {}
  const saved = {}

  // ===== 1. wolf kill =====
  let wolfVictim = null
  if (confirmed && players[confirmed]) {
    wolfVictim = confirmed
  } else if (confirmed) {
    // host อาจยืนยัน uid ที่ไม่อยู่ใน wolf picks (เช่นยิงแบบ manual) → ใช้ตามที่ยืนยัน
    wolfVictim = confirmed
  }

  // wolf_cub death → next night kill 2 (flag)
  const wolfCubKilled = playerIsWolfCubKilled(wolfVictim, players)

  // ===== 2. protections (doctor/bodyguard/witch save) =====
  let protectedUid = null
  for (const uid in night) {
    if (uid === 'wolf') continue
    const action = night[uid] || {}
    const role = getRole((players[uid] || {}).role)
    if (!role) continue
    if ((role.id === 'doctor' || role.id === 'bodyguard' || role.id === 'witch') && action.target) {
      if (action.save === true || role.id === 'doctor' || role.id === 'bodyguard') {
        protectedUid = action.target
      }
      if (role.id === 'witch' && action.save === true) {
        protectedUid = action.target
      }
    }
  }

  // ===== 3. witch poison =====
  let poisonTarget = null
  for (const uid in night) {
    if (uid === 'wolf') continue
    const action = night[uid] || {}
    const role = getRole((players[uid] || {}).role)
    if (role && role.id === 'witch' && action.poison && action.poisonTarget) {
      poisonTarget = action.poisonTarget
    }
  }

  // ===== 4. apply =====
  if (wolfVictim && protectedUid === wolfVictim) {
    saved[wolfVictim] = 'protect'
  } else if (wolfVictim) {
    dead[wolfVictim] = 'wolf'
  }

  if (poisonTarget && players[poisonTarget]) {
    // witch poison กันด้วย witch save ใช้ไม่ได้ (save ห้ามคืนเดียวกันกับ poison) → ตายเสมอ
    dead[poisonTarget] = 'poison'
  }

  // ===== 5. cursed transform =====
  const updates = {}
  const wasCursedVictim = wolfVictim && players[wolfVictim] && players[wolfVictim].role === 'cursed'
  if (wasCursedVictim && !dead[wolfVictim]) {
    // ถูกกัดแล้วรอด (มีคนช่วย) → ยังไม่เป็นหมาป่า (ต้องตายจากกัดเท่านั้นถึงเป็น)
  } else if (wasCursedVictim && dead[wolfVictim]) {
    // ถูกกัดตาย → Cursed กลายเป็นหมาป่าและตาย → จบ (Cursed ตายแต่เกมจบแบบหมาป่า)
    updates['players/' + wolfVictim + '/cursedStatus'] = 'wolf'
  }

  // ===== 6. alive flags =====
  const deadUids = Object.keys(dead)
  for (const uid of deadUids) {
    updates['players/' + uid + '/alive'] = false
    const role = getRole((players[uid] || {}).role)
    if (role && (role.id === 'hunter')) {
      updates['meta/hunterReveal'] = uid // hunter ตายกลางคืน → เปิดเช้า
    }
    if (role && role.id === 'wolf_cub') {
      updates['meta/wolfCubKilled'] = true // คืนถัดไป wolf ฆ่า 2 คน
    }
  }
  updates['meta/wolfCubKilled'] = wolfCubKilled

  updates['meta/phase'] = 'day'
  updates['meta/dayIndex'] = nightIndex
  updates['meta/nightResult'] = {
    dead: deadUids,
    saved: Object.keys(saved),
    wolfVictim: wolfVictim || null,
    usedWitchPoison: !!poisonTarget,
    hunterReveal: updates['meta/hunterReveal'] || null,
  }
  updates['meta/hostCall'] = ''

  // เคลียร์ wolf picks หลังจบ
  updates['wolf'] = {}

  await r.update(updates)
  return updates['meta/nightResult']
}

function playerIsWolfCubKilled(victim, players) {
  if (!victim || !players[victim]) return false
  return players[victim].role === 'wolf_cub'
}

// ===================== PLAYER =====================

// หมาป่าเลือกเหยื่อ (เขียน night/wolf/$uid/target)
async function playerWolfPick(code, targetUid) {
  const uid = getUserId()
  await wolfActionsRef(code).child(uid).update({ target: targetUid })
}

// ผู้เล่นเขียน action ของตัวเอง (night/$uid/action)
async function playerNightAction(code, action) {
  const uid = getUserId()
  await nightRef(code).child(uid).set({
    ...action,
    at: firebase.database.ServerValue.TIMESTAMP,
  })
}

// ===================== UI helpers =====================

// ดูว่า role นี้ต้อง "ลืมตา" หรือไม่ (มี action ในคืนนี้)
function roleHasNightAction(roleId) {
  return ['werewolf', 'wolf_cub', 'sorceress', 'seer', 'aura_seer', 'doctor', 'bodyguard', 'witch', 'cupid'].indexOf(roleId) >= 0
}

function getNightActionDesc(roleId) {
  switch (roleId) {
    case 'werewolf':
    case 'wolf_cub':
    case 'sorceress':
      return 'ลืมตา เลือกเหยื่อร่วมกับหมาป่าตัวอื่น (รอคนทรงยืนยัน)'
    case 'seer':
      return 'ลืมตา ตรวจผู้เล่น 1 คน'
    case 'aura_seer':
      return 'ลืมตา ตรวจบทบาทจริงของผู้เล่น 1 คน'
    case 'doctor':
      return 'ลืมตา เลือกปกป้อง 1 คน (ห้ามเป็นตัวเอง)'
    case 'bodyguard':
      return 'ลืมตา เลือกปกป้อง 1 คน (ปกป้องตัวเองได้ ห้ามซ้ำคนเดิมจากคืนก่อน)'
    case 'witch':
      return 'ลืมตา เลือกใช้ยาพิษ และ/หรือ ยาชุบชีวิต (ห้ามใช้พร้อมกัน)'
    case 'cupid':
      return 'ลืมตา เลือกคู่รัก 2 คน'
    default:
      return ''
  }
}
