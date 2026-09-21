function roomRef(code) {
  return db.ref('rooms/' + code)
}

function metaRef(code) {
  return db.ref('rooms/' + code + '/meta')
}

function playersRef(code) {
  return db.ref('rooms/' + code + '/players')
}

function playerRef(code, uid) {
  return db.ref('rooms/' + code + '/players/' + uid)
}

function getLocalName() {
  return localStorage.getItem('werewolf_name') || ''
}

function recommendedWolfCount(n) {
  if (n <= 6) return 2
  if (n <= 9) return 2
  if (n <= 12) return 3
  return 3
}

function buildRoleDeck(roleConfig, playerCount) {
  const deck = []
  for (const roleId in roleConfig) {
    const count = roleConfig[roleId] || 0
    for (let i = 0; i < count; i++) deck.push(roleId)
  }
  while (deck.length < playerCount) deck.push('villager')
  if (deck.length > playerCount) return null
  return deck
}

function countWolfInDeck(deck) {
  return deck.filter((r) => isWolfRole(r)).length
}

function validateConfig(roleConfig, playerCount) {
  const errors = []
  const warnings = []

  const deck = buildRoleDeck(roleConfig, playerCount)
  if (!deck) {
    errors.push('จำนวนบทบาทเกินจำนวนผู้เล่น ต้องไม่เกิน ' + playerCount + ' คน')
    return { errors, warnings }
  }

  const wolves = countWolfInDeck(deck)
  const villagers = playerCount - wolves

  if (wolves < 1) {
    errors.push('ต้องมีหมาป่าอย่างน้อย 1 ตัว')
  }
  if (wolves >= villagers) {
    errors.push('หมาป่าเยอะเกินไป เกมจะจบตั้งแต่เริ่ม (หมาป่า ≥ ชาวบ้าน)')
  }
  if (playerCount < 5) {
    errors.push('ต้องมีผู้เล่นอย่างน้อย 5 คน')
  }

  const masonCount = roleConfig.mason || 0
  if (masonCount > 0 && masonCount % 2 !== 0) {
    errors.push('Mason ต้องมีเป็นคู่ (2, 4, ...)')
  }

  const wolfCub = roleConfig.wolf_cub || 0
  const sorceress = roleConfig.sorceress || 0
  const minion = roleConfig.minion || 0
  if (wolfCub + sorceress + minion > 0 && wolves < 2) {
    warnings.push('Wolf Cub / Sorceress / Minion มักใช้กับหมาป่าหลายตัว Balance อาจเพี้ยน')
  }

  return { errors, warnings }
}

function shuffleArray(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildRoleAssignment(players, roleConfig) {
  const playerIds = Object.keys(players)
  const deck = buildRoleDeck(roleConfig, playerIds.length)
  if (!deck) return null
  const shuffled = shuffleArray(deck)
  const assignment = {}
  for (let i = 0; i < playerIds.length; i++) {
    assignment[playerIds[i]] = shuffled[i]
  }
  return assignment
}

function defaultRoleConfig(playerCount) {
  return {
    werewolf: recommendedWolfCount(playerCount),
  }
}

function getSettingRolesList() {
  return [
    { id: 'werewolf', type: 'count' },
    { id: 'wolf_cub', type: 'toggle' },
    { id: 'sorceress', type: 'toggle' },
    { id: 'minion', type: 'toggle' },
    { id: 'seer', type: 'toggle' },
    { id: 'aura_seer', type: 'toggle' },
    { id: 'doctor', type: 'toggle' },
    { id: 'bodyguard', type: 'toggle' },
    { id: 'hunter', type: 'toggle' },
    { id: 'witch', type: 'toggle' },
    { id: 'cupid', type: 'toggle' },
    { id: 'mayor', type: 'toggle' },
    { id: 'mason', type: 'toggle' },
    { id: 'diseased', type: 'toggle' },
    { id: 'insomniac', type: 'toggle' },
    { id: 'cursed', type: 'toggle' },
    { id: 'fool', type: 'toggle' },
  ]
}

function isHostNamed(code, meta) {
  return meta && meta.host === getUserId()
}

async function ensureJoined(code, name, maxPlayers = 16) {
  const uid = getUserId()
  const r = roomRef(code)
  const snap = await r.once('value')
  const data = snap.val()
  if (!data) {
    throw new Error('ไม่พบห้องนี้')
  }

  const exists = !!(data.players && data.players[uid])
  const phase = data.meta && data.meta.phase

  if (data.meta && data.meta.host === uid) {
    return true
  }

  if (exists) {
    await playerRef(code, uid).update({ joinedAt: firebase.database.ServerValue.TIMESTAMP })
    return true
  }

  if (phase !== 'lobby') {
    throw new Error('เกมเริ่มแล้ว ไม่สามารถเข้าร่วมได้')
  }

  if (data.meta && data.meta.locked === true) {
    throw new Error('ห้องถูกล็อกแล้ว (คนทรงล็อกห้องไว้)')
  }

  const count = data.players ? Object.keys(data.players).length : 0
  if (count >= maxPlayers) {
    throw new Error('ห้องเต็มแล้ว')
  }

  await playerRef(code, uid).set({
    name: name,
    joinedAt: firebase.database.ServerValue.TIMESTAMP,
  })
  return true
}