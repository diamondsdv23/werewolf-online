// ===================== CURSED =====================
// - ถูกเรียกทุกคืน เมื่อ host ส่ง hostCall==='cursed'
// - ถ้าถูกหมาป่ากัดในคืนนี้ → แจ้ง Cursed ทันทีในคืนนั้น (เขียน cursedStatus='wolf')
// - ยังไม่ถูกกัด → ยังเป็นชาวบ้าน (ปิดตาได้)
// - ถูกโหวตก่อนกัด → เจอใน day/vote flow ตายเป็นชาวบ้านปกติ (เป็น role ชาวบ้านตอนนั้น)

// ชื่อผู้เล่นแบบกันว่าง (ไม่อิง playerName ซึ่งอยู่เฉพาะ player.js)
function cursedPlayerName(p, uid) {
  const n = (p && p.name) || ''
  return (n && n.trim()) ? n : 'ผู้เล่น-' + String(uid || '').slice(-4)
}

// ผู้เล่น targetUid ถูกคุ้มครองคืนนี้หรือไม่? (doctor / bodyguard / witch save)
function isProtectedThisNight(night, nightIndex, targetUid) {
  if (!night || !targetUid) return false
  for (const uid in night) {
    if (uid === 'wolf') continue
    const a = night[uid] || {}
    if (a.nightIndex !== nightIndex || !a.target) continue
    const isDoc = a.action === 'doctor' || a.action === 'bodyguard'
    const isWitchSave = a.action === 'witch' && a.save === true
    if ((isDoc || isWitchSave) && a.target === targetUid) return true
  }
  return false
}

// เป็นฝ่ายหมาป่าหรือไม่ (ใช้โดย Seer / host)
function isWolfSide(p) {
  if (!p) return false
  if (p.role === 'werewolf' || p.role === 'wolf_cub' || p.role === 'sorceress' || p.role === 'minion') return true
  if (p.role === 'cursed') return p.cursedStatus === 'wolf'
  return false
}

// Host-side: ประเมินว่า Cursed ถูกกัดคืนนี้ไหม + เขียนสถานะ (เรียกเมื่อ hostCall==='cursed')
// คืน: { status: 'villager'|'wolf', justTurned, saved }
async function evaluateCursedNight(code, cursedUid) {
  const snap = await roomRef(code).once('value')
  const data = snap.val() || {}
  const meta = data.meta || {}
  const night = data.night || {}
  const players = data.players || {}
  const nightIndex = meta.nightIndex || 0
  const cursed = players[cursedUid] || {}

  if (cursed.cursedStatus === 'wolf') {
    return { status: 'wolf', justTurned: false, saved: false }
  }

  let bitten = false
  for (const uid in night) {
    if (uid === 'wolf') continue
    const a = night[uid] || {}
    const vote = a.wolfVote || {}
    if (a.action === 'wolf' && a.nightIndex === nightIndex && a.target === cursedUid) bitten = true
    if (vote.nightIndex === nightIndex && vote.target === cursedUid) bitten = true
  }

  if (bitten) {
    const saved = isProtectedThisNight(night, nightIndex, cursedUid)
    if (!saved) {
      await roomRef(code).child('players').child(cursedUid).update({ cursedStatus: 'wolf' })
      return { status: 'wolf', justTurned: true, saved: false }
    }
    return { status: 'villager', justTurned: false, saved: true }
  }
  return { status: 'villager', justTurned: false, saved: false }
}

// ชื่อทีมหมาป่าจาก meta.wolfTeammates (ใช้ฝั่ง player + host)
function wolfTeamNames(data) {
  const meta = data.meta || {}
  const mates = meta.wolfTeammates || []
  return mates.map((u) => cursedPlayerName((data.players || {})[u], u)).join(', ')
}

// ข้อความสถานะ Cursed (ใช้ฝั่ง host)
function cursedStatusText(p, name) {
  return (name || '?') + (p && p.cursedStatus === 'wolf' ? ' (กลายเป็นหมาป่าแล้ว)' : ' (ยังเป็นชาวบ้าน)')
}