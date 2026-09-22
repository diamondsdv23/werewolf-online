const code = new URLSearchParams(location.search).get('code') || ''
const codeEl = document.getElementById('room-code')
const playerCountEl = document.getElementById('player-count')
const playerListEl = document.getElementById('player-list')
const settingListEl = document.getElementById('setting-list')
const configSummaryEl = document.getElementById('config-summary')
const validationBoxEl = document.getElementById('validation-box')
const btnStart = document.getElementById('btn-start')
const errorEl = document.getElementById('error-message')
const winBannerEl = document.getElementById('win-banner')
const winBannerTitleEl = document.getElementById('win-banner-title')
const winBannerReasonEl = document.getElementById('win-banner-reason')
const setupViewEl = document.getElementById('setup-view')
const gameViewEl = document.getElementById('game-view')
const roleListEl = document.getElementById('role-list')
const wolfRecEl = document.getElementById('wolf-recommend')

if (!code) {
  window.location.href = 'index.html'
}
codeEl.textContent = code

let roomData = null
let roleConfig = {}

function showError(msg) {
  errorEl.textContent = msg
  errorEl.classList.remove('hidden')
}
function hideError() {
  errorEl.classList.add('hidden')
}

function isHost(data) {
  return data && data.meta && data.meta.host === getUserId()
}

function getPlayers(data) {
  const players = (data && data.players) || {}
  return Object.entries(players).filter(([uid]) => uid !== (data.meta || {}).host)
}

function renderPlayers(players, hostUid) {
  playerCountEl.textContent = players.length
  playerListEl.innerHTML = ''
  for (const [uid, p] of players.sort((a, b) => a[1].joinedAt - b[1].joinedAt)) {
    const li = document.createElement('li')
    li.className = 'player-row'
    li.textContent = ((p.name && p.name.trim()) ? p.name : 'ผู้เล่น-' + String(uid).slice(-4))
    if (uid === hostUid) {
      li.innerHTML += ' <span class="tag tag-host">คนทรง</span>'
    }
    if (uid === getUserId()) {
      li.innerHTML += ' <span class="tag tag-me">คุณ</span>'
    }
    playerListEl.appendChild(li)
  }
}

function renderSettingList() {
  const list = getSettingRolesList()
  settingListEl.innerHTML = ''
  for (const item of list) {
    const role = getRole(item.id)
    if (!role) continue

    const row = document.createElement('div')
    row.className = 'setting-row'
    row.dataset.role = item.id

    const info = document.createElement('div')
    info.className = 'setting-info'
    info.innerHTML =
      '<div class="setting-name">' + role.nameTh + ' <em>' + role.nameEn + '</em></div>' +
      '<div class="setting-desc">' + role.desc + '</div>'

    const control = document.createElement('div')
    control.className = 'setting-control'

    if (item.type === 'count') {
      control.className = 'setting-control stepper'
      control.innerHTML =
        '<button type="button" data-step="-1">−</button>' +
        '<span class="stepper-value">' + (roleConfig[item.id] || 0) + '</span>' +
        '<button type="button" data-step="1">+</button>'
    } else {
      const on = !!(roleConfig[item.id] > 0)
      const label = item.id === 'mason' ? 'คู่' : 'เปิด'
      control.innerHTML =
        '<button type="button" class="toggle-btn' + (on ? ' toggle-on' : '') + '" data-toggle="1">' +
        (on ? '✓ ' + label : label) +
        '</button>'
    }

    row.appendChild(info)
    row.appendChild(control)
    settingListEl.appendChild(row)
  }
}

function updateControls() {
  const rows = settingListEl.querySelectorAll('.setting-row')
  for (const row of rows) {
    const id = row.dataset.role
    const role = getRole(id)
    const valueCard = row.querySelector('.setting-control')
    if (row.querySelector('.stepper')) {
      row.querySelector('.stepper-value').textContent = roleConfig[id] || 0
    } else {
      const on = !!(roleConfig[id] > 0)
      const btn = row.querySelector('.toggle-btn')
      const label = id === 'mason' ? 'คู่' : 'เปิด'
      btn.classList.toggle('toggle-on', on)
      btn.textContent = on ? '✓ ' + label : label
    }
    void role
  }
}

function applyToggle(id) {
  const role = getRole(id)
  if (!role) return
  const isOn = !!(roleConfig[id] > 0)
  const value = id === 'mason' ? 2 : 1
  roleConfig[id] = isOn ? 0 : value
}

function renderConfigSummary(players) {
  const totalRoles = getSettingRolesList().reduce((sum, r) => sum + (roleConfig[r.id] || 0), 0)
  const freeVillagers = Math.max(0, players.length - totalRoles)
  const wolves = roleConfig.werewolf || 0
  configSummaryEl.innerHTML =
    'บทบาทที่เลือก ' + totalRoles + '/' + players.length +
    ' · ชาวบ้านอัตโนมัติ ' + freeVillagers +
    ' · หมาป่า ' + wolves
}

function renderValidation(players) {
  const { errors, warnings } = validateConfig(roleConfig, players.length)
  validationBoxEl.innerHTML = ''
  if (errors.length === 0 && warnings.length === 0) {
    validationBoxEl.innerHTML = '<div class="validation-ok">พร้อมเริ่มเกม ✓</div>'
    btnStart.disabled = false
    return
  }
  for (const e of errors) {
    validationBoxEl.innerHTML += '<div class="validation-error">⛔ ' + e + '</div>'
  }
  for (const w of warnings) {
    validationBoxEl.innerHTML += '<div class="validation-warn">⚠️ ' + w + '</div>'
  }
  btnStart.disabled = errors.length > 0
}

function handleSettingClick(e) {
  const target = e.target.closest('button')
  if (!target) return
  const row = target.closest('.setting-row')
  if (!row) return
  const id = row.dataset.role

  if (target.dataset.step) {
    const value = roleConfig[id] || 0
    const next = Math.max(0, value + parseInt(target.dataset.step, 10))
    const max = id === 'werewolf' ? 4 : 1
    roleConfig[id] = Math.min(next, max)
  } else {
    applyToggle(id)
  }
  updateControls()
  renderConfigSummary(getPlayers(roomData))
  renderValidation(getPlayers(roomData))
}

async function assignRolesAndStart() {
  const players = getPlayers(roomData)
  const { errors } = validateConfig(roleConfig, players.length)
  if (errors.length > 0) {
    showError(errors[0])
    return
  }

  const playersObj = {}
  for (const [uid, p] of players) playersObj[uid] = p
  const assignment = buildRoleAssignment(playersObj, roleConfig)
  if (!assignment) {
    showError('จำนวนบทบาทเกินจำนวนผู้เล่น')
    return
  }

  hideError()
  btnStart.disabled = true
  btnStart.textContent = 'กำลังแจก Role...'

  const updates = {}
  for (const uid in assignment) {
    updates['players/' + uid + '/role'] = assignment[uid]
    updates['players/' + uid + '/alive'] = true
  }
  updates['meta/phase'] = 'role'
  updates['meta/settings'] = { roles: roleConfig }
  updates['meta/startedAt'] = firebase.database.ServerValue.TIMESTAMP

  await roomRef(code).update(updates)
}

btnStart.addEventListener('click', assignRolesAndStart)
settingListEl.addEventListener('click', handleSettingClick)


// ============ Phase 3 · HOST NIGHT SEQUENCER ============
const nightViewEl = document.getElementById('night-view')
const nightSeqIndexEl = document.getElementById('night-seq-index-el')
const nightSeqStatusEl = document.getElementById('night-seq-status-el')
const callRoleViewEl = document.getElementById('call-role-view')
const callRoleNameEl = document.getElementById('call-role-name-el')
const btnNightCallNextEl = document.getElementById('btn-night-call-next')
const actionViewEl = document.getElementById('action-view')
const actionListEl = document.getElementById('action-list-el')
const wolfViewEl = document.getElementById('wolf-view')
const wolfPickCountEl = document.getElementById('wolf-pick-count-el')
const wolfPickTotalEl = document.getElementById('wolf-pick-total-el')
const wolfPickListEl = document.getElementById('wolf-pick-list-el')
const wolfConfirmTargetEl = document.getElementById('wolf-confirm-target-el')
const btnWolfConfirmEl = document.getElementById('btn-wolf-confirm')
const btnWolfSkipEl = document.getElementById('btn-wolf-skip')
const afkViewEl = document.getElementById('afk-view')
const afkListEl = document.getElementById('afk-list-el')
const cursedViewEl = document.getElementById('cursed-view')
const cursedInfoEl = document.getElementById('cursed-info-el')
const btnStartNightEl = document.getElementById('btn-start-night')
const btnFinishNightEl = document.getElementById('btn-finish-night')

let lastNightRenderRoomData = null
let cursedEvalSig = ''

function nightRoleHasAction(roleId) {
  return ROLE_NIGHT_ACTIONS.has(roleId)
}

function nameOf(roomData, uid) {
  const p = (roomData && roomData.players && roomData.players[uid]) || {}
  return (p.name && p.name.trim()) ? p.name : 'ผู้เล่น-' + String(uid).slice(-4)
}

function wolfLike(roomData, uid) {
  const p = (roomData && roomData.players && roomData.players[uid]) || {}
  return p.role === 'werewolf' || p.role === 'cursed' || p.role === 'sorceress'
}

function renderNightSequencer(roomData) {
  lastNightRenderRoomData = roomData
  if (!roomData || !nightViewEl) return
  const meta = roomData.meta || {}
  const isNight = meta.phase === 'night'
  const showNightPanel = meta.phase === 'night' || meta.phase === 'role'
  if (showNightPanel) {
    nightViewEl.classList.remove('hidden')
    nightViewEl.style.display = ''
  } else {
    nightViewEl.classList.add('hidden')
    nightViewEl.style.display = 'none'
  }
  if (!isNight) return
  nightSeqIndexEl.textContent = String(meta.nightIndex || 0)

  // Role Caller — hostCall ส่งผ่าน meta (hostCallNextRole เขียน meta/hostCall)
  const call = meta.hostCall || ''
  const callViewOn = meta.phase === 'night' || (call && call !== 'DONE')
  callRoleViewEl.classList.toggle('hidden', !callViewOn)
  if (callViewOn) {
    const r = getRole(call)
    callRoleNameEl.textContent = (r ? r.nameTh + ' (' + r.nameEn + ')' : call) + ' ← เรียกผ่านหน้าหมวกของแต่ละคน'
  }
nightSeqStatusEl.textContent =
    call === 'DONE' ? (meta.wolfConfirmed || meta.wolfSkipped ? 'เรียกครบแล้ว — host กด จบกลางคืน · เปิดเช้า' : 'เรียกครบแล้ว — host ยืนยัน Wolf หรือกด ข้าม (หมาป่า AFK)')
    : callViewOn ? 'กำลังเรียก Role — รอ action จากเจ้าของ role'
    : meta.wolfSkipped ? '🕊️ host ข้ามการฆ่าแล้ว (หมาป่า AFK) — กด จบกลางคืน · เปิดเช้า'
    : meta.wolfConfirmed ? 'Wolf เลือกครบแล้ว — host กด จบกลางคืน · เปิดเช้า'
    : 'กลางคืนเริ่มแล้ว — host เริ่มเรียก Role'
  if (meta.wolvesSick === true && meta.phase === 'night') {
    nightSeqStatusEl.textContent = '🤒 หมาป่าป่วย (Diseased คืนก่อน) — คืนนี้หมาป่าฆ่าใครไม่ได้ · ' + nightSeqStatusEl.textContent
  }

  // Night actions ที่มีอยู่ (night/$uid self-write) — รวม wolfVote ของหมาป่า
  const night = roomData.night || {}
  const entries = Object.entries(night).filter(([uid, a]) => a && (a.action || a.wolfVote) && uid !== 'wolf')
  actionViewEl.classList.toggle('hidden', entries.length === 0)
  actionListEl.innerHTML = ''
  for (const [uid, a] of entries) {
    const li = document.createElement('li')
    if (a.action === 'cupid') {
      const ts = a.targets || []
      li.textContent = nameOf(roomData, uid) + ' → 💘 คู่รัก: ' + ts.map((t) => nameOf(roomData, t)).join(' + ')
    } else if (a.action === 'witch') {
      const parts = []
      if (a.save) parts.push('ยาชุบ @ ' + nameOf(roomData, a.target))
      if (a.poison) parts.push('ยาพิษ @ ' + nameOf(roomData, a.poisonTarget))
      li.textContent = nameOf(roomData, uid) + ' → 🧪 แม่มด: ' + (parts.length ? parts.join(' · ') : 'ไม่ใช้ยา')
    } else if (a.action === 'sorceress') {
      li.textContent = nameOf(roomData, uid) + ' → 🔮 ตรวจ Seer @ ' + nameOf(roomData, a.target)
    } else if (a.wolfVote && a.wolfVote.target) {
      li.textContent = nameOf(roomData, uid) + ' → 🐺 เลือกเหยื่อ @ ' + nameOf(roomData, a.wolfVote.target)
    } else {
      li.textContent = nameOf(roomData, uid) + ' → ' + (a.action || '') + (a.target ? (' @ ' + nameOf(roomData, a.target)) : '')
    }
    actionListEl.appendChild(li)
  }

  // Wolf picks (night/$uid.wolfVote คืนนี้) + AFK gathering
  const voted = new Set()
  const wolfTargets = new Set()
  for (const [uid, a] of entries) {
    const av = a.wolfVote || {}
    if (!av.target || av.nightIndex !== meta.nightIndex) continue
    voted.add(uid)
    wolfTargets.add(av.target)
  }
  const allPlayers = Object.entries(roomData.players || {})
  const wolfPlayers = allPlayers.filter(([uid, p]) => p.role === 'werewolf' || p.role === 'wolf_cub' || p.role === 'sorceress' || (p.role === 'cursed' && p.cursedStatus === 'wolf'))
  wolfPickCountEl.textContent = String(wolfTargets.size)
  wolfPickTotalEl.textContent = String(wolfPlayers.length)
  wolfPickListEl.innerHTML = ''
  for (const [uid, p] of wolfPlayers) {
    const li = document.createElement('li')
    li.textContent = nameOf(roomData, uid) + (voted.has(uid) ? ' ✓ เลือกแล้ว' : ' ⏳ ยังไม่เลือก')
    wolfPickListEl.appendChild(li)
  }

  // Host confirm wolf — select เป้าที่ Wolf โหวต
  wolfConfirmTargetEl.innerHTML = ''
  const targetNames = {}
  for (const uid of wolfTargets) {
    const opt = document.createElement('option')
    opt.value = uid
    opt.textContent = nameOf(roomData, uid)
    wolfConfirmTargetEl.appendChild(opt)
  }
  wolfConfirmTargetEl.classList.toggle('hidden', wolfTargets.size === 0)
  btnWolfConfirmEl.disabled = wolfTargets.size === 0 || !!meta.wolfConfirmed
  btnWolfSkipEl.disabled = !!meta.wolfConfirmed
  // host กดจบกลางคืนได้เมื่อ: เรียก role ครบแล้ว + (confirm เป้าแล้ว หรือ host ข้ามการฆ่าไปแล้ว)
  btnFinishNightEl.disabled = call !== 'DONE' || (!meta.wolfConfirmed && meta.wolfSkipped !== true)

  // AFK — role ที่มี action กลางคืนยังไม่เขียนคืนนี้
  const acted = new Set([...entries.map(([uid]) => uid)])
  const afkList = allPlayers.filter(([uid, p]) => nightRoleHasAction(p.role) && !acted.has(uid))
  afkViewEl.classList.toggle('hidden', afkList.length === 0)
  afkListEl.innerHTML = ''
  for (const [uid] of afkList) {
    const li = document.createElement('li')
    li.textContent = nameOf(roomData, uid)
    afkListEl.appendChild(li)
  }

  // Cursed status (ลด กับการเรียกทุกคืน - hostCall==='cursed')
  const cursed = allPlayers.filter(([, p]) => p.role === 'cursed')
  cursedViewEl.classList.toggle('hidden', cursed.length === 0)
  cursedInfoEl.textContent = cursed.length
    ? cursed.map(([uid, p]) => cursedStatusText(p, nameOf(roomData, uid))).join(', ')
    : '—'

  // เมื่อ host เรียก Cursed → ระบบประเมินทันทีว่าถูกกัดคืนนี้ไหม แล้วเขียนสถานะ (แจ้งในคืนนั้น)
  const callId = meta.hostCall || ''
  if (callId === 'cursed' && cursedEvalSig !== meta.nightIndex + ':cursed' && cursed.length) {
    cursedEvalSig = meta.nightIndex + ':cursed'
    const cuid = cursed[0][0]
    evaluateCursedNight(code, cuid).then((res) => {
      const txt = res.justTurned
        ? 'ถูกหมาป่ากัดแล้ว → กลายเป็นหมาป่าแล้วในคืนนี้! ระบบแจ้ง Cursed ทันที'
        : (res.status === 'wolf'
          ? 'กลายเป็นหมาป่าแล้ว (จากคืนก่อน)'
          : (res.saved ? 'ถูกหมาป่ากัด แต่มีคนช่วย → ยังเป็นชาวบ้าน' : 'ยังเป็นชาวบ้าน (ยังไม่ถูกกัดในคืนนี้)'))
      cursedInfoEl.textContent = nameOf(roomData, cuid) + ' → ' + txt
    }).catch(() => {})
  }

  // ผลตรวจ seer / aura_seer / sorceress → echo ไป meta/results/$uid (player เห็นผลทันที)
  echoCheckResults(roomData).catch(() => {})
}

// คำนวณผลตรวจจาก night action แล้ว echo ไป meta/results/$uid (host เขียน meta ได้)
// เขียนเฉพาะเมื่อผลเปลี่ยน (กัน loop) — player อ่าน meta ได้
async function echoCheckResults(data) {
  const meta = data.meta || {}
  const players = data.players || {}
  const night = data.night || {}
  const nightIndex = meta.nightIndex || 0
  const prevResults = meta.results || {}
  const updates = {}
  let changed = false

  for (const uid in night) {
    if (uid === 'wolf') continue
    const a = night[uid] || {}
    const roleId = (players[uid] || {}).role
    if (!roleId || (roleId !== 'seer' && roleId !== 'aura_seer' && roleId !== 'sorceress')) continue
    if (!a.target || a.nightIndex !== nightIndex) continue

    const tgt = players[a.target] || {}
    const tgtRole = getRole(tgt.role)
    let result
    if (roleId === 'seer') {
      result = { nightIndex: nightIndex, isWolf: isWolfSide(tgt), name: nameOf(data, a.target) }
    } else if (roleId === 'aura_seer') {
      result = { nightIndex: nightIndex, roleId: (tgtRole || {}).id || '?', nameTh: (tgtRole || {}).nameTh || '?' }
    } else {
      result = { nightIndex: nightIndex, isSeer: tgt.role === 'seer', name: nameOf(data, a.target) }
    }

    const prev = prevResults[uid] || {}
    if (JSON.stringify(result) !== JSON.stringify(prev)) {
      updates['meta/results/' + uid] = result
      changed = true
    }
  }

  if (changed) await roomRef(code).update(updates)
}

btnStartNightEl.addEventListener('click', () => {
  hostStartNight(code)
    .then(() => hostCallNextRole(code))
    .then(() => { nightSeqStatusEl.textContent = 'กลางคืนเริ่มแล้ว — host เริ่มเรียก Role' })
    .catch((err) => showError('เริ่มกลางคืนไม่สำเร็จ: ' + err.message))
})

btnNightCallNextEl.addEventListener('click', () => {
  hostCallNextRole(code).then(() => {}).catch((err) => showError('เรียก Role ถัดไปไม่สำเร็จ: ' + err.message))
})

btnWolfConfirmEl.addEventListener('click', () => {
  const target = wolfConfirmTargetEl.value
  if (!target) return
  hostConfirmWolf(code, target).then(() => {}).catch((err) => showError('ยืนยัน Wolf ไม่สำเร็จ: ' + err.message))
})

btnWolfSkipEl.addEventListener('click', () => {
  if (!confirm('หมาป่ายังไม่เลือกเหยื่อ — ข้ามการฆ่าคืนนี้?')) return
  hostSkipWolf(code).then(() => {}).catch((err) => showError('ข้าม Wolf ไม่สำเร็จ: ' + err.message))
})

btnFinishNightEl.addEventListener('click', () => {
  hostFinishNight(code).then(() => {}).catch((err) => showError('จบกลางคืนไม่สำเร็จ: ' + err.message))
})

const ROLE_NIGHT_ACTIONS = new Set([
  'werewolf', 'wolf_cub', 'sorceress', 'cursed',
  'seer', 'aura_seer', 'doctor', 'bodyguard', 'witch', 'cupid',
])
initAuth().then(() => {
  const r = roomRef(code)
  r.on('value', (snap) => {
    const data = snap.val()
    if (!data) {
      showError('ไม่พบห้องนี้')
      return
    }

    if (!isHost(data)) {
      window.location.href = 'lobby.html?code=' + code
      return
    }

    roomData = data
    const meta = data.meta || {}
    const players = getPlayers(data)

    wolfRecEl.textContent = recommendedWolfCount(players.length)

    if (meta.phase === 'lobby') {
      setupViewEl.classList.remove('hidden')
      gameViewEl.classList.add('hidden')
      renderPlayers(players, meta.host)
      if (Object.keys(roleConfig).length === 0) {
        roleConfig = defaultRoleConfig(players.length)
      }
      renderSettingList()
      renderConfigSummary(players)
      renderValidation(players)
    } else {
      setupViewEl.classList.add('hidden')
      gameViewEl.classList.remove('hidden')
      renderNightSequencer(roomData)
      if (winBannerEl && meta.win) {
        winBannerEl.classList.remove('hidden')
        const w = meta.win
        const label = { villagers: 'ชาวบ้านชนะ!', wolves: 'หมาป่าชนะ!', lovers: 'คู่รักชนะ!', fool: 'คนโง่ชนะ!' }
        winBannerTitleEl.textContent = '🏆 ' + (label[w.winner] || w.winner)
        winBannerReasonEl.textContent = w.reason || ''
      } else if (winBannerEl) {
        winBannerEl.classList.add('hidden')
      }
      const rp = getPlayers(roomData)
      const allRole = rp.length >= 5 && rp.every(([, p]) => !!p.role)
      btnStart.disabled = !allRole
      roleListEl.innerHTML = ''
      const entries = getPlayers(data).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))
      for (const [uid, p] of entries) {
        const role = getRole(p.role)
        if (!role) continue
        const li = document.createElement('li')
        li.className = 'role-list-item'
        li.innerHTML =
          '<img class="role-icon" src="assets/roles/' + role.icon + '" alt="' + role.nameTh + '" />' +
          '<div class="role-list-info"><div class="player-name">' + ((p.name && p.name.trim()) ? p.name : 'ผู้เล่น-' + String(uid).slice(-4)) + '</div>' +
          '<div class="role-name">' + role.nameTh + ' <em>' + role.nameEn + '</em></div></div>'
        roleListEl.appendChild(li)
      }
    }
  })
}).catch((err) => showError('เชื่อมต่อไม่สำเร็จ: ' + err.message))
