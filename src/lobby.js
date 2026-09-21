const code = new URLSearchParams(location.search).get('code') || ''
const codeEl = document.getElementById('room-code')
const playerListEl = document.getElementById('player-list')
const playerCountEl = document.getElementById('player-count')
const waitingMsgEl = document.getElementById('waiting-msg')
const btnHost = document.getElementById('btn-host')
const errorEl = document.getElementById('error-message')
const hostControlsEl = document.getElementById('host-controls')
const lockToggleEl = document.getElementById('lock-toggle')

function showError(msg) {
  errorEl.textContent = msg
  errorEl.classList.remove('hidden')
}
function hideError() {
  errorEl.classList.add('hidden')
}

if (!code) {
  window.location.href = 'index.html'
}

codeEl.textContent = code
btnHost.href = 'host.html?code=' + code

function renderPlayers(players, hostUid) {
  const entries = Object.entries(players || {})
  playerCountEl.textContent = entries.length
  const isHost = hostUid === getUserId()

  if (entries.length === 0) {
    playerListEl.innerHTML = '<li class="player-row empty">ยังไม่มีผู้เล่น</li>'
    return
  }

  playerListEl.innerHTML = ''
  for (const [uid, p] of entries.sort((a, b) => a[1].joinedAt - b[1].joinedAt)) {
    const li = document.createElement('li')
    li.className = 'player-row'

    const nameSpan = document.createElement('span')
    nameSpan.className = 'player-name'
    const nm = String(p.name || '').trim()
    nameSpan.textContent = nm || 'ผู้เล่น-' + String(uid).slice(-4)

    const tags = document.createElement('span')
    tags.className = 'player-tags'
    if (uid === hostUid) {
      tags.innerHTML += '<span class="tag tag-host">คนทรง</span>'
    }
    if (uid === getUserId()) {
      tags.innerHTML += '<span class="tag tag-me">คุณ</span>'
    }

    if (isHost && uid !== hostUid) {
      const kickBtn = document.createElement('button')
      kickBtn.className = 'btn btn-danger'
      kickBtn.textContent = 'ลบ'
      kickBtn.style.cssText = 'margin-left:auto;padding:4px 10px;font-size:12px;'
      kickBtn.addEventListener('click', () => {
        if (window.confirm('ลบ ' + (nameSpan.textContent || 'ผู้เล่นนี้') + ' ออกจากห้อง?')) {
          playersRef(code).child(uid).remove().catch((err) => showError('ลบไม่สำเร็จ: ' + err.message))
        }
      })
      li.appendChild(kickBtn)
    }

    li.appendChild(nameSpan)
    li.appendChild(tags)
    playerListEl.appendChild(li)
  }
}

function handleRoomData(snap) {
  const data = snap.val()
  if (!data) {
    showError('ไม่พบห้องนี้')
    return
  }
  const meta = data.meta || {}
  const players = data.players || {}
  const hostUid = meta.host

  renderPlayers(players, hostUid)

  if (meta.phase && meta.phase !== 'lobby') {
    const isHost = hostUid === getUserId()
    window.location.href = isHost
      ? 'host.html?code=' + code
      : 'player.html?code=' + code
    return
  }

  const isHost = hostUid === getUserId()
  if (isHost) {
    btnHost.classList.remove('hidden')
    waitingMsgEl.classList.add('hidden')
    if (hostControlsEl) hostControlsEl.classList.remove('hidden')
    if (lockToggleEl && lockToggleEl.checked !== !!meta.locked) lockToggleEl.checked = !!meta.locked
  } else {
    btnHost.classList.add('hidden')
    waitingMsgEl.textContent = 'รอคนทรงเริ่มเกม...'
    waitingMsgEl.classList.remove('hidden')
    if (hostControlsEl) hostControlsEl.classList.add('hidden')
  }
}

if (lockToggleEl) {
  lockToggleEl.addEventListener('change', () => {
    metaRef(code).update({ locked: !!lockToggleEl.checked }).catch((err) => showError('ตั้งล็อกไม่สำเร็จ: ' + err.message))
  })
}

initAuth().then(() => {
  const r = roomRef(code)
  r.on('value', handleRoomData)
  ensureJoined(code, getLocalName()).catch((err) => {
    showError('เข้าร่วมห้องไม่สำเร็จ: ' + err.message)
  })
}).catch((err) => showError('เชื่อมต่อไม่สำเร็จ: ' + err.message))