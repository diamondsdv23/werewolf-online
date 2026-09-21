// ===================== WIN CHECK =====================
// เรียกที่: จบคืน, จบโหวต, Hunter ยิง, Lovers ตายตาม, Witch วางยา, Cursed กลายร่าง
// คืน: { winner: 'villagers'|'wolves'|'lovers'|'fool', reason: string } | null

function countAliveBySide(players) {
  const wolves = []
  const villagers = []
  for (const [uid, p] of Object.entries(players || {})) {
    if (!p || p.alive === false) continue
    ;(isWolfSide(p) ? wolves : villagers).push(uid)
  }
  return { wolves, villagers }
}

function checkWinCondition(players, meta, opts) {
  if (!players) return null
  meta = meta || {}
  opts = opts || {}

  // นับเฉพาะผู้เล่นที่ยังมีชีวิตอยู่ (หมาป่า = werewolf/wolf_cub/sorceress/minion + cursed หลังกลายร่าง)
  const alive = Object.entries(players).filter(([, p]) => p && p.alive !== false)

  // 1. Fool ถูกโหวตออก → ชนะทันที เกมจบ
  if (opts.foolVotedOut) {
    return { winner: 'fool', reason: 'คนโง่ถูกโหวตออก — ชนะทันที' }
  }

  // 2. Lovers ต่างฝ่ายเหลือ 2 คนสุดท้าย → ชนะด้วยกัน
  const lovers = meta.lovers || []
  if (lovers.length === 2 && alive.length === 2) {
    if (alive.some(([u]) => u === lovers[0]) && alive.some(([u]) => u === lovers[1])) {
      const wa = isWolfSide(players[lovers[0]])
      const wb = isWolfSide(players[lovers[1]])
      if (wa !== wb) {
        return { winner: 'lovers', reason: 'คู่รักต่างฝ่ายเป็น 2 คนสุดท้าย — ชนะด้วยกัน' }
      }
    }
  }

  // 3. หมาป่า = 0 → ชาวบ้านชนะ
  const { wolves, villagers } = countAliveBySide(players)
  if (wolves.length === 0) {
    return { winner: 'villagers', reason: 'หมาป่าทั้งหมดตายแล้ว' }
  }

  // 4. หมาป่า ≥ ชาวบ้าน → หมาป่าชนะ
  if (wolves.length >= villagers.length) {
    return { winner: 'wolves', reason: 'หมาป่า (' + wolves.length + ') ≥ ชาวบ้าน (' + villagers.length + ')' }
  }

  return null
}