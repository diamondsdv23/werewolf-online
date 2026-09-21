const playerNameInput = document.getElementById('player-name')
const roomCodeInput = document.getElementById('room-code')
const btnCreate = document.getElementById('btn-create')
const btnJoin = document.getElementById('btn-join')
const errorEl = document.getElementById('error-message')

const savedName = localStorage.getItem('werewolf_name')
if (savedName) {
  playerNameInput.value = savedName
}

function showError(msg) {
  errorEl.textContent = msg
  errorEl.classList.remove('hidden')
}
function hideError() {
  errorEl.classList.add('hidden')
}
function getName() {
  const name = playerNameInput.value.trim()
  if (!name) {
    showError('กรุณาใส่ชื่อของคุณ')
    return null
  }
  localStorage.setItem('werewolf_name', name)
  return name
}

function generateRoomCode() {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += Math.floor(Math.random() * 10).toString()
  }
  return code
}

btnCreate.addEventListener('click', async () => {
  const name = getName()
  if (!name) return

  hideError()
  try {
    const code = generateRoomCode()
    const roomRef = db.ref('rooms/' + code)

    const snapshot = await roomRef.once('value')
    if (snapshot.exists()) {
      showError('รหัสซ้ำ กรุณาลองอีกครั้ง')
      return
    }

    await roomRef.set({
      meta: {
        host: getUserId(),
        phase: 'lobby',
        settings: {},
        createdAt: firebase.database.ServerValue.TIMESTAMP,
      },
    })

    window.location.href = 'lobby.html?code=' + code
  } catch (err) {
    showError('สร้างห้องไม่สำเร็จ: ' + err.message)
  }
})

btnJoin.addEventListener('click', async () => {
  const name = getName()
  if (!name) return

  const code = roomCodeInput.value.trim()
  if (!code || code.length !== 4) {
    showError('กรุณาใส่รหัสห้อง 4 หลัก')
    return
  }

  hideError()
  try {
    const roomRef = db.ref('rooms/' + code)
    const snapshot = await roomRef.once('value')

    if (!snapshot.exists()) {
      showError('ไม่พบห้องนี้')
      return
    }

    const roomData = snapshot.val()
    if (roomData.meta.phase !== 'lobby') {
      showError('เกมเริ่มแล้ว ไม่สามารถเข้าร่วมได้')
      return
    }

    const alreadyIn = roomData.players && roomData.players[getUserId()]
    if (roomData.meta.locked === true && !alreadyIn) {
      showError('ห้องถูกล็อกแล้ว (คนทรงล็อกห้องไว้)')
      return
    }

    const playerCount = roomData.players ? Object.keys(roomData.players).length : 0
    if (playerCount >= 16) {
      showError('ห้องเต็มแล้ว')
      return
    }

    await roomRef.child('players/' + getUserId()).set({
      name: name,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
    })

    window.location.href = 'lobby.html?code=' + code
  } catch (err) {
    showError('เข้าร่วมห้องไม่สำเร็จ: ' + err.message)
  }
})

roomCodeInput.addEventListener('input', hideError)

initAuth().catch((err) => {
  showError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: ' + err.message)
})