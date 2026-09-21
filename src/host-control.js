const code = new URLSearchParams(location.search).get('code') || ''
const codeEl = document.getElementById('room-code')
const playerCountEl = document.getElementById('player-count')
const playerListEl = document.getElementById('player-list')
const settingListEl = document.getElementById('setting-list')
const configSummaryEl = document.getElementById('config-summary')
const validationBoxEl = document.getElementById('validation-box')
const btnStart = document.getElementById('btn-start')
const errorEl = document.getElementById('error-message')
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
    li.textContent = p.name || '???'
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
const afkViewEl = document.getElementById('afk-view')
const afkListEl = document.getElementById('afk-list-el')
const cursedViewEl = document.getElementById('cursed-view')
const cursedInfoEl = document.getElementById('cursed-info-el')
const btnStartNightEl = document.getElementById('btn-start-night')
const btnFinishNightEl = document.getElementById('btn-finish-night')

let lastNightRenderRoomData = null

function nightRoleHasAction(roleId) {
  return ROLE_NIGHT_ACTIONS.has(roleId)
}

function nameOf(roomData, uid) {
  const p = (roomData && roomData.players && roomData.players[uid]) || {}
  return p.name || uid
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
    call === 'DONE' ? 'เรียกครบแล้ว — host ยืนยัน Wolf แล้วกด จบกลางคืน'
    : callViewOn ? 'กำลังเรียก Role — รอ action จากเจ้าของ role'
    : meta.wolfConfirmed ? 'Wolf เลือกครบแล้ว — host กด จบกลางคืน · เปิดเช้า'
    : 'กลางคืนเริ่มแล้ว — host เริ่มเรียก Role'

  // Night actions ที่มีอยู่ (night/$uid self-write)
  const night = roomData.night || {}
  const entries = Object.entries(night).filter(([uid, a]) => a && a.action && uid !== 'wolf')
  actionViewEl.classList.toggle('hidden', entries.length === 0)
  actionListEl.innerHTML = ''
  for (const [uid, a] of entries) {
    const li = document.createElement('li')
    li.textContent = nameOf(roomData, uid) + ' → ' + (a.action || '') + (a.target ? (' @ ' + nameOf(roomData, a.target)) : '')
    actionListEl.appendChild(li)
  }

  // Wolf picks (action=wolf ที่เขียนคืนนี้) + AFK gathering
  const voted = new Set()
  const wolfTargets = new Set()
  for (const [uid, a] of entries) {
    if (a.action !== 'wolf') continue
    voted.add(uid)
    if (a.target) wolfTargets.add(a.target)
  }
  const allPlayers = Object.entries(roomData.players || {})
  const wolfPlayers = allPlayers.filter(([uid, p]) => p.role === 'werewolf' || p.role === 'wolf_cub' || (p.role === 'cursed' && p.cursed === true))
  wolfPickCountEl.textContent = String(wolfTargets.size)
  wolfPickTotalEl.textContent = String(wolfPlayers.length)
  const pickedNames = [...wolfTargets].map((u) => nameOf(roomData, u))
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

  // Cursed status
  const cursed = allPlayers.filter(([, p]) => p.role === 'cursed')
  cursedViewEl.classList.toggle('hidden', cursed.length === 0)
  cursedInfoEl.textContent = cursed.length ? cursed.map(([uid, p]) => nameOf(roomData, uid) + (p.cursed ? ' (กลายเป็นหมาป่า)' : ' (ยังเป็นชาวบ้าน)')).join(', ') : '—'
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

btnFinishNightEl.addEventListener('click', () => {
  hostFinishNight(code).then(() => {}).catch((err) => showError('จบกลางคืนไม่สำเร็จ: ' + err.message))
})

const ROLE_NIGHT_ACTIONS = new Set([
  'werewolf', 'wolf_cub', 'sorceress', 'cursed',
  'seer', 'doctor', 'bodyguard', 'witch',
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
          '<div class="role-list-info"><div class="player-name">' + (p.name || '???') + '</div>' +
          '<div class="role-name">' + role.nameTh + ' <em>' + role.nameEn + '</em></div></div>'
        roleListEl.appendChild(li)
      }
    }
  })
}).catch((err) => showError('เชื่อมต่อไม่สำเร็จ: ' + err.message))
