const code = new URLSearchParams(location.search).get('code') || ''
const codeEl = document.getElementById('room-code')
const playerListEl = document.getElementById('player-list')
const playerCountEl = document.getElementById('player-count')
const waitingMsgEl = document.getElementById('waiting-msg')
const btnHost = document.getElementById('btn-host')
const errorEl = document.getElementById('error-message')

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
    nameSpan.textContent = nm || 'ผู้เล่นที่ยังไม่ตั้งชื่อ'

    const tags = document.createElement('span')
    tags.className = 'player-tags'
    if (uid === hostUid) {
      tags.innerHTML += '<span class="tag tag-host">คนทรง</span>'
    }
    if (uid === getUserId()) {
      tags.innerHTML += '<span class="tag tag-me">คุณ</span>'
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
  } else {
    btnHost.classList.add('hidden')
    waitingMsgEl.textContent = 'รอคนทรงเริ่มเกม...'
    waitingMsgEl.classList.remove('hidden')
  }
}

initAuth().then(() => {
  const r = roomRef(code)
  r.on('value', handleRoomData)
  ensureJoined(code, getLocalName()).catch((err) => {
    showError('เข้าร่วมห้องไม่สำเร็จ: ' + err.message)
  })
}).catch((err) => showError('เชื่อมต่อไม่สำเร็จ: ' + err.message))