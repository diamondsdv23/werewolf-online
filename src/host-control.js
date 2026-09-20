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