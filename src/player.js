const code = new URLSearchParams(location.search).get('code') || ''
const codeEl = document.getElementById('room-code')
const roleCardEl = document.getElementById('role-card')
const waitingViewEl = document.getElementById('waiting-view')
const roleIconEl = document.getElementById('role-icon')
const roleTeamEl = document.getElementById('role-team')
const roleNameEl = document.getElementById('role-name')
const roleDescEl = document.getElementById('role-desc')
const errorEl = document.getElementById('error-message')

// Night action UI
const nightActionViewEl = document.getElementById('night-action-view')
const nightActionStatusEl = document.getElementById('night-action-status-el')
const nightActionFormEl = document.getElementById('night-action-form')
const nightActionDoneEl = document.getElementById('night-action-done-el')

function showError(msg) {
  errorEl.textContent = msg
  errorEl.classList.remove('hidden')
}

function getMe(data) {
  return (data.players && data.players[getUserId()]) || null
}

function aliveTargets(data, excludeSelf) {
  const all = Object.entries(data.players || {})
    .filter(([uid, p]) => p && p.role && p.alive !== false && (!excludeSelf || uid !== getUserId()))
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))
  return all
}

function wolfCall(roleId) {
  return roleId === 'werewolf' || roleId === 'wolf_cub' || roleId === 'sorceress' ||
    (roleId === 'cursed' && true)
}

function buildNightForm(data, role) {
  nightActionFormEl.innerHTML = ''
  const targets = aliveTargets(data, wolfCall(role.id))
  const targetNames = Object.fromEntries(targets.map(([uid, p]) => [uid, p.name || uid]))

  const sel = document.createElement('select')
  sel.className = 'input'
  sel.style.cssText = 'margin-top:6px;width:100%;'
  for (const [uid, p] of targets) {
    const opt = document.createElement('option')
    opt.value = uid
    opt.textContent = p.name || uid
    sel.appendChild(opt)
  }
  const btn = document.createElement('button')
  btn.className = 'btn btn-primary'
  btn.style.cssText = 'margin-top:8px;'
  const label = document.createElement('div')
  label.className = 'setting-name'

  if (wolfCall(role.id)) {
    label.textContent = '🐺 เลือกเหยื่อ (กับหมาป่าทีมเดียวกันผ่าน host):'
    btn.textContent = 'ยืนยันเลือกเหยื่อ'
    btn.addEventListener('click', async () => {
      const target = sel.value
      if (!target) return
      btn.disabled = true
      btn.textContent = 'ส่งแล้ว...'
      try {
        await playerWolfPick(code, target)
        nightActionDoneEl.classList.remove('hidden')
        nightActionFormEl.innerHTML = ''
      } catch (e) {
        btn.disabled = false
        btn.textContent = 'ยืนยันเลือกเหยื่อ'
        showError('ส่งไม่สำเร็จ: ' + e.message)
      }
    })
  } else {
    const descMap = {
      seer: ['🔮 ผู้หยั่งรู้ — ตรวจผู้เล่น 1 คน', 'ยืนยันตรวจ'],
      aura_seer: ['🌟 ผู้หยั่งรู้ออร่า — ตรวจผู้เล่น 1 คน', 'ยืนยันตรวจ'],
      doctor: ['💉 หมอ — เลือกปกป้อง 1 คน (ห้ามเป็นตัวเอง)', 'ยืนยันปกป้อง'],
      bodyguard: ['🛡️ บอดี้การ์ด — เลือกปกป้อง 1 คน', 'ยืนยันปกป้อง'],
      witch: ['🧪 แม่มด — เลือกคนช่วย 1 คน (คืนนี้กันตาย)', 'ยืนยันช่วย'],
    }
    const d = descMap[role.id]
    label.textContent = d[0]
    btn.textContent = d[1]
    btn.addEventListener('click', async () => {
      const target = sel.value
      if (!target) return
      btn.disabled = true
      btn.textContent = 'ส่งแล้ว...'
      try {
        await playerNightAction(code, { action: role.id, target })
        nightActionDoneEl.classList.remove('hidden')
        nightActionFormEl.innerHTML = ''
      } catch (e) {
        btn.disabled = false
        btn.textContent = d[1]
        showError('ส่งไม่สำเร็จ: ' + e.message)
      }
    })
  }

  const labelWrap = document.createElement('label')
  labelWrap.appendChild(label)
  nightActionFormEl.appendChild(labelWrap)
  nightActionFormEl.appendChild(sel)
  nightActionFormEl.appendChild(btn)
}

function useNightActionUI(data, meta) {
  if (!nightActionViewEl) return
  const me = getMe(data)
  const role = me && me.role ? getRole(me.role) : null
  const isNight = meta.phase === 'night'
  const call = meta.hostCall || ''

  if (!isNight) {
    nightActionViewEl.classList.add('hidden')
    return
  }

  nightActionViewEl.classList.remove('hidden')

  // player เห็น status เสมอ แต่โชว์ฟอร์มเฉพาะเมื่อ host เรียก role ตัวเอง
  nightActionDoneEl.classList.add('hidden')
  nightActionFormEl.innerHTML = ''

  if (!role) {
    nightActionStatusEl.textContent = '🌙 กลางคืน... รอ host เรียก'
    return
  }

  if (call === role.id) {
    nightActionStatusEl.textContent = '🌙 host กำลังเรียก: ' + role.nameTh + ' — ลืมตาแล้วตอบ'
    const actionDesc = getNightActionDesc(role.id)
    if (roleHasNightAction(role.id)) {
      buildNightForm(data, role)
    } else {
      nightActionStatusEl.textContent = '🌙 host กำลังเรียก: ' + role.nameTh + ' (ไม่มี action — ปิดตาได้)'
    }
  } else {
    nightActionStatusEl.textContent =
      call ? '🌙 host กำลังเรียก: ' + (getRole(call) ? getRole(call).nameTh : call) + ' — ยังไม่ถึงตาเรา'
      : '🌙 กลางคืน... รอ host เรียก'
  }
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

    const me = getMe(data)
    if (!me) {
      window.location.href = 'lobby.html?code=' + code
      return
    }

    if (!me.role) {
      roleCardEl.classList.add('hidden')
      waitingViewEl.classList.remove('hidden')
      nightActionViewEl.classList.add('hidden')
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
    roleNameEl.innerHTML = role.nameTh + ' <em>' + role.nameEn + '</em>'
    roleDescEl.textContent = role.desc

    useNightActionUI(data, meta)
  })
}).catch((err) => showError('เชื่อมต่อไม่สำเร็จ: ' + err.message))