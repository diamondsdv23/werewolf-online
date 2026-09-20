const code = new URLSearchParams(location.search).get('code') || ''
const codeEl = document.getElementById('room-code')
const roleCardEl = document.getElementById('role-card')
const waitingViewEl = document.getElementById('waiting-view')
const roleIconEl = document.getElementById('role-icon')
const roleTeamEl = document.getElementById('role-team')
const roleNameEl = document.getElementById('role-name')
const roleDescEl = document.getElementById('role-desc')
const errorEl = document.getElementById('error-message')

function showError(msg) {
  errorEl.textContent = msg
  errorEl.classList.add('hidden')
}

if (!code) {
  window.location.href = 'index.html'
}
codeEl.textContent = code

initAuth().then(() => {
  const r = roomRef(code)
  r.on('value', (snap) => {
    const data = snap.val()
    if (!data) {
      showError('ไม่พบห้องนี้')
      return
    }
    const meta = data.meta || {}
    if (meta.host === getUserId()) {
      window.location.href = 'host.html?code=' + code
      return
    }

    const me = (data.players && data.players[getUserId()]) || null
    if (!me) {
      window.location.href = 'lobby.html?code=' + code
      return
    }

    if (!me.role) {
      roleCardEl.classList.add('hidden')
      waitingViewEl.classList.remove('hidden')
      return
    }

    const role = getRole(me.role)
    if (!role) return

    waitingViewEl.classList.add('hidden')
    roleCardEl.classList.remove('hidden')

    const team = getTeam(role.id)

    roleIconEl.src = 'assets/roles/' + role.icon
    roleIconEl.alt = role.nameTh
    roleTeamEl.textContent = team.nameTh
    roleTeamEl.style.background = team.color
    roleNameEl.textContent = role.nameTh
    roleNameEl.innerHTML = role.nameTh + ' <em>' + role.nameEn + '</em>'
    roleDescEl.textContent = role.desc
  })
}).catch((err) => showError('เชื่อมต่อไม่สำเร็จ: ' + err.message))