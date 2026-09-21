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
  'mason', // เห็นกัน ไม่ต้องตอบ action
  'insomniac', // ไม่มี action (ชนะกับฝ่ายชาวบ้าน)
  'diseased', // flag เฉยๆ (wolf ป่วยคืนถัดไปถ้าตายจากกัด)
]

function nightRef(code) {
  return db.ref('rooms/' + code + '/night')
}

function metaNightRef(code) {
  return db.ref('rooms/' + code + '/meta')
}

function wolfActionsRef(code) {
  // wolf picks เก็บที่ night/$uid (self-write ตาม rules ที่ publish อยู่แล้ว:
  // night/$uid .write = auth.uid === $uid → werewolf/wolf_cub/sorceress/cursed-wolf ทุกตัวเขียนได้)
  // → ไม่ต้องแก้ rules/ไม่ต้อง publish ใหม่
  return db.ref('rooms/' + code + '/night')
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

  // wolf picks → night/$uid (self-write ตาม rules ที่ publish อยู่แล้ว:
  // night/$uid .write = auth.uid === $uid → werewolf/wolf_cub/sorceress/cursed-wolf เขียนได้หมด)
  // → ไม่ต้อง init/เคลียร์ wolf node / ไม่ต้องแก้ rules / ไม่ต้อง publish ใหม่

  const wolfTeammates = []
  for (const [uid, p] of playerList) {
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
  // confirm เฉยๆ — ไม่เช็คชนะตรงนี้ เพราะตอนยังไม่ apply dead/save/poison/cursed/lovers
  // state ยังค้างกลางคืน จะเช็คผิด → เช็คชนะที่ hostFinishNight เท่านั้น (apply ครบแล้ว)
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
  const nightIndex = meta.nightIndex || 0
  const confirmed = meta.wolfConfirmed
  // host เคลียร์ night/$uid ไม่ได้ (rules: self-write เท่านั้น ถึงเคลียร์ได้เฉพาะของตัวเอง)
  // → wolf picks อ่านจาก night/$uid ที่ action==='wolf' + nightIndex ตรงคืนนี้ (กัน pick ค้างจากคืนก่อน)
  const wolfPicks = {}
  for (const uid in night) {
    if (uid === 'wolf') continue
    const a = night[uid] || {}
    const av = a.wolfVote || {}
    if (av.target && av.nightIndex === nightIndex) {
      wolfPicks[uid] = { target: av.target, nightIndex: av.nightIndex }
    }
  }

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

  // wolf_cub death → next night kill 2 (flag) — คำนวณจาก deadUids หลัง apply (FIX 6a)

  // ===== 2. protections (doctor/bodyguard/witch save) =====
  let protectedUid = null
  for (const uid in night) {
    if (uid === 'wolf') continue
    const action = night[uid] || {}
    if (action.nightIndex !== nightIndex) continue
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
    if (action.nightIndex !== nightIndex) continue
    const role = getRole((players[uid] || {}).role)
    if (role && role.id === 'witch' && action.poison && action.poisonTarget) {
      poisonTarget = action.poisonTarget
    }
  }

  // ===== 4. apply =====
  // Diseased ถูก wolf kill คืนก่อน → meta/wolvesSick=true → คืนนี้หมาป่าป่วย ฆ่าไม่ได้
  const wolvesSick = meta.wolvesSick === true
  if (wolfVictim && !wolvesSick && protectedUid === wolfVictim) {
    saved[wolfVictim] = 'protect'
  } else if (wolfVictim && !wolvesSick) {
    dead[wolfVictim] = 'wolf'
  }

  if (poisonTarget && players[poisonTarget]) {
    // witch poison กันด้วย witch save ใช้ไม่ได้ (save ห้ามคืนเดียวกันกับ poison) → ตายเสมอ
    dead[poisonTarget] = 'poison'
  }

  // ===== 5. lovers (Cupid คืนแรก) =====
  let lovers = null
  for (const uid in night) {
    if (uid === 'wolf') continue
    const a = night[uid] || {}
    const role = getRole((players[uid] || {}).role)
    if (role && role.id === 'cupid' && a.action === 'cupid' && a.nightIndex === 1 && a.targets && a.targets.length === 2) {
      lovers = a.targets
      break
    }
  }
  if (lovers) updates['meta/lovers'] = lovers
  if (lovers) {
    // คนหนึ่งตาย → อีกคนตายตามทันที (ทุกสาเหตุ)
    for (const l of lovers) {
      const other = lovers[0] === l ? lovers[1] : lovers[0]
      if (dead[l] && !dead[other]) dead[other] = 'lover'
    }
  }

  // ===== 6. cursed transform =====
  // กลไกตามแผน: Cursed ถูกกัดจริง (ไม่โดน save) → กลายเป็นหมาป่าแทนที่จะตาย (ไม่ตาย)
  // - ถูกกัด + ไม่ save → ไม่ตาย + กลายเป็นหมาป่า (undo ความตาย)
  // - ถูกกัด + save → ยังเป็นชาวบ้าน (dead ไม่มีชื่ออยู่แล้ว เพราะถูกกันไว้ที่ apply)
  // - ตายจากเหตุอื่น (poison/โหวต) → ตายปกติ ไม่แปลง
  const updates = {}
  const deadUids = Object.keys(dead)
  const wasCursedVictim = wolfVictim && players[wolfVictim] && players[wolfVictim].role === 'cursed' && dead[wolfVictim] === 'wolf'
  if (wasCursedVictim && !saved[wolfVictim]) {
    updates['players/' + wolfVictim + '/cursedStatus'] = 'wolf'
    const ci = deadUids.indexOf(wolfVictim)
    if (ci >= 0) deadUids.splice(ci, 1) // undo คำว่า "ตาย"
    delete dead[wolfVictim]
  }

  // ===== 7. alive flags =====
  for (const uid of deadUids) {
    updates['players/' + uid + '/alive'] = false
    const role = getRole((players[uid] || {}).role)
    if (role && (role.id === 'hunter')) {
      updates['meta/hunterReveal'] = uid // hunter ตายกลางคืน → เปิดเช้า
    }
    if (role && role.id === 'wolf_cub') {
      // wolf_cub ตายด้วยวิธีไหนก็ตาม → คืนถัดไปหมาป่าฆ่า 2 (FIX 6a: ไม่มี overwrite จากบรรทัดอื่นแล้ว)
      updates['meta/wolfCubKilled'] = true
    }
  }

  // Diseased ถูก wolf kill จริง → คืนถัดไปหมาป่าป่วย ฆ่าใครไม่ได้ (meta/wolvesSick)
  const diedByWolfKill = !!wolfVictim && dead[wolfVictim] === 'wolf'
  if (diedByWolfKill && players[wolfVictim] && players[wolfVictim].role === 'diseased') {
    updates['meta/wolvesSick'] = true
  }
  if (wolvesSick) updates['meta/wolvesSick'] = false // หมาป่าป่วย 1 คืนแล้ว → หาย

  // ===== 7. win check (หลัง apply ครบ: wolf/save/poison/lovers/cursed/hunter/wolfcub/diseased) =====
  const metaProj = { ...meta }
  if (lovers) metaProj.lovers = lovers
  const projPlayers = {}
  for (const [uid, p] of Object.entries(players)) {
    projPlayers[uid] = { ...p }
    if (deadUids.indexOf(uid) >= 0) projPlayers[uid].alive = false
    if (updates['players/' + uid + '/cursedStatus']) projPlayers[uid].cursedStatus = updates['players/' + uid + '/cursedStatus']
  }
  const win = checkWinCondition(projPlayers, metaProj)

  if (win) {
    updates['meta/win'] = win
    updates['meta/phase'] = 'end'
  } else {
    updates['meta/phase'] = 'day'
  }
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

// ===================== PLAYER =====================

// หมาป่าเลือกเหยื่อ (wolfVote เก็บใน night/$uid — self-write ตาม rules ที่ publish อยู่แล้ว
// ใช้ update ไม่ใช่ set เพื่อให้ sorceress ที่ตรวจทีหลังไม่ลบ wolf vote ของตัวเอง)
async function playerWolfPick(code, targetUid) {
  const uid = getUserId()
  const metaSnap = await metaNightRef(code).child('nightIndex').once('value')
  const nightIndex = metaSnap.val() || 0
  await nightRef(code).child(uid).update({
    wolfVote: { target: targetUid, nightIndex },
  })
}

// ผู้เล่นเขียน action ของตัวเอง (night/$uid — update กันลบ wolfVote)
async function playerNightAction(code, action) {
  const uid = getUserId()
  const metaSnap = await metaNightRef(code).child('nightIndex').once('value')
  const nightIndex = metaSnap.val() || 0
  await nightRef(code).child(uid).update({
    ...action,
    nightIndex,
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
