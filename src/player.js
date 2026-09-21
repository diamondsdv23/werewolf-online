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

function playerName(p, uid) {
  const n = (p && p.name) || ''
  return (n.trim() ? n : 'ผู้เล่น-' + String(uid || '').slice(-4))
}

function aliveTargets(data, excludeSelf) {
  const all = Object.entries(data.players || {})
    .filter(([uid, p]) => p && p.role && p.alive !== false && (!excludeSelf || uid !== getUserId()))
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))
  return all
}

function isWolfCallRole(me) {
  if (me.role === 'werewolf' || me.role === 'wolf_cub' || me.role === 'sorceress') return true
  if (me.role === 'cursed') return me.cursedStatus === 'wolf'
  return false
}

function makeSelect(targets, placeholder) {
  const sel = document.createElement('select')
  sel.className = 'input'
  sel.style.cssText = 'margin-top:6px;width:100%;'
  if (placeholder) {
    const ph = document.createElement('option')
    ph.value = ''
    ph.textContent = placeholder
    sel.appendChild(ph)
  }
  for (const [uid, p] of targets) {
    const opt = document.createElement('option')
    opt.value = uid
    opt.textContent = playerName(p, uid)
    sel.appendChild(opt)
  }
  return sel
}

function buildNightForm(data, role, me) {
  nightActionFormEl.innerHTML = ''
  const btn = document.createElement('button')
  btn.className = 'btn btn-primary'
  btn.style.cssText = 'margin-top:8px;'
  const label = document.createElement('div')
  label.className = 'setting-name'

  const wolf = isWolfCallRole(me)

  if (wolf) {
    label.textContent = '🐺 เลือกเหยื่อ (กับหมาป่าทีมเดียวกัน — เห็นกัน ไม่มีแชท):'
    const mates = (data.meta && data.meta.wolfTeammates) || []
    if (mates.length) {
      const chips = document.createElement('div')
      chips.className = 'hint'
      chips.style.cssText = 'margin-top:6px;color:var(--danger);'
      chips.textContent = '🐺 ทีม: ' + mates.map((u) => playerName((data.players || {})[u], u)).join(', ')
      nightActionFormEl.appendChild(chips)
    }
    const targets = aliveTargets(data, true)
    const sel = makeSelect(targets)
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
    nightActionFormEl.appendChild(label)
    nightActionFormEl.appendChild(sel)
    nightActionFormEl.appendChild(btn)
    return
  }

  switch (role.id) {
    case 'cupid': {
      label.textContent = '💘 คิวปิด — เลือกคู่รัก 2 คน (คืนแรก):'
      const targets = aliveTargets(data, true)
      const selA = makeSelect(targets, 'เลือกคนที่ 1...')
      const selB = makeSelect(targets, 'เลือกคนที่ 2...')
      btn.textContent = 'ยืนยันคู่รัก'
      btn.addEventListener('click', async () => {
        const a = selA.value
        const b = selB.value
        if (!a || !b) {
          showError('ต้องเลือกคู่รักครบ 2 คน')
          return
        }
        if (a === b) {
          showError('คู่รักต้องเป็นคนต่างกัน')
          return
        }
        btn.disabled = true
        btn.textContent = 'ส่งแล้ว...'
        try {
          await playerNightAction(code, { action: 'cupid', targets: [a, b] })
          nightActionDoneEl.classList.remove('hidden')
          nightActionFormEl.innerHTML = ''
        } catch (e) {
          btn.disabled = false
          btn.textContent = 'ยืนยันคู่รัก'
          showError('ส่งไม่สำเร็จ: ' + e.message)
        }
      })
      nightActionFormEl.appendChild(label)
      nightActionFormEl.appendChild(selA)
      nightActionFormEl.appendChild(selB)
      nightActionFormEl.appendChild(btn)
      return
    }

    case 'sorceress': {
      label.textContent = '🔮 แม่มดหมาป่า — ตรวจว่าผู้เล่นคนไหนเป็น Seer:'
      const targets = aliveTargets(data, false)
      const sel = makeSelect(targets)
      btn.textContent = 'ยืนยันตรวจ'
      btn.addEventListener('click', async () => {
        const target = sel.value
        if (!target) return
        btn.disabled = true
        btn.textContent = 'ส่งแล้ว...'
        try {
          await playerNightAction(code, { action: 'sorceress', target })
          nightActionDoneEl.classList.remove('hidden')
          nightActionFormEl.innerHTML = ''
        } catch (e) {
          btn.disabled = false
          btn.textContent = 'ยืนยันตรวจ'
          showError('ส่งไม่สำเร็จ: ' + e.message)
        }
      })
      nightActionFormEl.appendChild(label)
      nightActionFormEl.appendChild(sel)
      nightActionFormEl.appendChild(btn)
      return
    }

    case 'witch': {
      label.textContent = '🧪 แม่มด — เลือกยาชุบชีวิต และ/หรือ ยาพิษ (คืนละ 1 อย่าง):'
      const targets = aliveTargets(data, false)
      const selSave = makeSelect(targets, '— ไม่ใช้ยาชุบ —')
      const selPoison = makeSelect(targets, '— ไม่ใช้ยาพิษ —')
      btn.textContent = 'ยืนยัน'
      btn.addEventListener('click', async () => {
        const save = selSave.value
        const poison = selPoison.value
        if (poison && poison === save) {
          showError('ยาพิษกับยาชุบต้องใช้กับคนต่างกัน')
          return
        }
        const action = { action: 'witch' }
        if (save) action.save = true, action.target = save
        if (poison) action.poison = true, action.poisonTarget = poison
        if (!save && !poison) {
          showError('เลือกยาอย่างน้อย 1 อย่าง')
          return
        }
        btn.disabled = true
        btn.textContent = 'ส่งแล้ว...'
        try {
          await playerNightAction(code, action)
          nightActionDoneEl.classList.remove('hidden')
          nightActionFormEl.innerHTML = ''
        } catch (e) {
          btn.disabled = false
          btn.textContent = 'ยืนยัน'
          showError('ส่งไม่สำเร็จ: ' + e.message)
        }
      })
      nightActionFormEl.appendChild(label)
      nightActionFormEl.appendChild(document.createElement('div')).textContent = ''
      const t1 = document.createElement('div')
      t1.className = 'setting-name'
      t1.style.cssText = 'margin-top:8px;'
      t1.textContent = 'ยาชุบชีวิต (ช่วยคนตาย):'
      nightActionFormEl.appendChild(t1)
      nightActionFormEl.appendChild(selSave)
      const t2 = document.createElement('div')
      t2.className = 'setting-name'
      t2.style.cssText = 'margin-top:8px;'
      t2.textContent = 'ยาพิษ (ฆ่า 1 คน):'
      nightActionFormEl.appendChild(t2)
      nightActionFormEl.appendChild(selPoison)
      nightActionFormEl.appendChild(btn)
      return
    }

    default: {
      const descMap = {
        seer: ['🔮 ผู้หยั่งรู้ — ตรวจผู้เล่น 1 คน (รู้ว่าหมาป่าหรือไม่)', 'ยืนยันตรวจ'],
        aura_seer: ['🌟 ผู้หยั่งรู้ออร่า — ตรวจบทบาทจริงของผู้เล่น 1 คน', 'ยืนยันตรวจ'],
        doctor: ['💉 หมอ — เลือกปกป้อง 1 คน (ห้ามเป็นตัวเอง)', 'ยืนยันปกป้อง'],
        bodyguard: ['🛡️ บอดี้การ์ด — เลือกปกป้อง 1 คน', 'ยืนยันปกป้อง'],
      }
      const d = descMap[role.id]
      if (!d) {
        nightActionStatusEl.textContent = '🌙 host กำลังเรียก: ' + role.nameTh + ' (ไม่มี action — ปิดตาได้)'
        return
      }
      label.textContent = d[0]
      btn.textContent = d[1]
      const excludeSelf = role.id === 'doctor'
      const targets = aliveTargets(data, excludeSelf)
      const sel = makeSelect(targets)
      btn.addEventListener('click', async () => {
        const target = sel.value
        if (!target) return
        btn.disabled = true
        btn.textContent = 'ส่งแล้ว...'
        try {
          await playerNightAction(code, { action: role.id, target })
          nightActionFormEl.innerHTML = ''
          if (role.id === 'seer' || role.id === 'aura_seer' || role.id === 'sorceress') {
            showCheckResult(data, '✅ ส่งผลตรวจแล้ว — ปิดตาได้')
          } else {
            nightActionDoneEl.classList.remove('hidden')
            nightActionDoneEl.textContent = '✅ ส่ง action แล้ว — ปิดตาได้'
          }
        } catch (e) {
          btn.disabled = false
          btn.textContent = d[1]
          showError('ส่งไม่สำเร็จ: ' + e.message)
        }
      })
      nightActionFormEl.appendChild(label)
      nightActionFormEl.appendChild(sel)
      nightActionFormEl.appendChild(btn)
      return
    }
  }
}

function useNightActionUI(data, meta) {
  if (!nightActionViewEl) return
  const me = getMe(data)
  if (!me || !me.role) {
    nightActionViewEl.classList.add('hidden')
    return
  }
  const role = getRole(me.role)
  const isNight = meta.phase === 'night'
  const call = meta.hostCall || ''

  if (!isNight) {
    nightActionViewEl.classList.add('hidden')
    return
  }

  nightActionViewEl.classList.remove('hidden')
  nightActionDoneEl.classList.add('hidden')
  nightActionFormEl.innerHTML = ''

  if (!role) {
    nightActionStatusEl.textContent = '🌙 กลางคืน... รอ host เรียก'
    return
  }

  const wolfTeam = (meta.wolfTeammates || []).indexOf(getUserId()) >= 0
  const myEntry = (data.night || {})[getUserId()] || {}
  const isCurNight = myEntry.nightIndex === (meta.nightIndex || 0)
  const doneWolfPick = isCurNight && myEntry.wolfVote && myEntry.wolfVote.nightIndex === (meta.nightIndex || 0)
  const doneOwnTask = isCurNight && myEntry.action === role.id

  // หมาป่า (werewolf/wolf_cub/sorceress/cursed-กลายร่าง) ตอบที่ step 'werewolf' — เห็นกัน ไม่มีแชท
  if (call === 'werewolf' && wolfTeam) {
    if (doneWolfPick) {
      nightActionStatusEl.textContent = '✅ เลือกเหยื่อแล้ว — รอหมาป่าทีมอื่น / host ยืนยัน'
      return
    }
    nightActionStatusEl.textContent = '🐺 host เรียกหมาป่า — ลืมตาเลือกเหยื่อร่วมกัน'
    buildNightForm(data, null, me)
    return
  }

  if (call !== role.id) {
    nightActionStatusEl.textContent =
      call ? '🌙 host กำลังเรียก: ' + (getRole(call) ? getRole(call).nameTh : call) + ' — ยังไม่ถึงตาเรา'
      : '🌙 กลางคืน... รอ host เรียก'
    return
  }

  nightActionStatusEl.textContent = '🌙 host กำลังเรียก: ' + role.nameTh + ' — ลืมตาแล้วตอบ'

  // cupid กินเฉพาะคืนแรก
  if (role.id === 'cupid' && (meta.nightIndex || 0) !== 1) {
    nightActionStatusEl.textContent = '🌙 host กำลังเรียก: ' + role.nameTh + ' (หมดสิทธิ์คืนแรกแล้ว — ปิดตาได้)'
    return
  }

  // cursed: ถูกเรียกทุกคืน → ระบบแจ้งสถานะทันทีในคืนนั้น
  if (role.id === 'cursed') {
    if (me.cursedStatus === 'wolf') {
      nightActionStatusEl.textContent = '🌙 host เรียก Cursed — กลายเป็นหมาป่าแล้ว! 🐺 เหล่าหมาป่า: ' + wolfTeamNames(data) + ' (ร่วมเลือกเหยื่อได้คืนถัดไป)'
    } else {
      nightActionStatusEl.textContent = '🌙 host เรียก Cursed — ยังเป็นชาวบ้าน (ยังไม่ถูกกัด — ปิดตาได้)'
    }
    return
  }

  // mason: เห็นคู่เมสัน (รู้กันว่าเป็นฝ่ายดี) — ไม่ต้องตอบ action
  if (role.id === 'mason') {
    const mates = Object.entries(data.players || {})
      .filter(([uid, p]) => p && p.role === 'mason' && uid !== getUserId())
      .map(([uid, p]) => playerName(p, uid))
    nightActionStatusEl.textContent = '🧱 host เรียก Mason — เหล่าเมสัน: ' + (mates.length ? mates.join(', ') : '—') + ' (รู้กันว่าเป็นฝ่ายดี — ปิดตาได้)'
    return
  }

  // เขียน action แล้วในคืนนี้ → กันฟอร์มเด้งกลับ + แสดงผลตรวจถ้ามี
  if (doneOwnTask) {
    if (role.id === 'seer' || role.id === 'aura_seer' || role.id === 'sorceress') {
      nightActionStatusEl.textContent = '✅ ส่งผลตรวจแล้ว — รอ host ประกาศ'
      showCheckResult(data, '✅ ส่งผลตรวจแล้ว — ปิดตาได้')
    } else {
      nightActionStatusEl.textContent = '✅ ส่ง action แล้ว — ปิดตาได้'
    }
    return
  }

  buildNightForm(data, role, me)
}

// แสดงผลตรวจ (จาก meta/results/$uid ที่ host echo) ถ้ามีในคืนนี้ ไม่งั้น fallback
function showCheckResult(data, fallback) {
  if (!nightActionDoneEl) return
  const meta = data.meta || {}
  const mine = (meta.results || {})[getUserId()]
  nightActionDoneEl.classList.remove('hidden')
  if (mine && mine.nightIndex === (meta.nightIndex || 0)) {
    if (mine.isWolf !== undefined) {
      nightActionDoneEl.textContent = mine.name + (mine.isWolf ? ' คือหมาป่า! 🔮' : ' คือชาวบ้าน 🔮')
    } else if (mine.isSeer !== undefined) {
      nightActionDoneEl.textContent = mine.name + (mine.isSeer ? ' คือ Seer! 🐺' : ' ไม่ใช่ Seer 🐺')
    } else if (mine.nameTh) {
      nightActionDoneEl.textContent = mine.name + ' คือ ' + mine.nameTh + ' 🌟'
    } else {
      nightActionDoneEl.textContent = fallback
    }
  } else {
    nightActionDoneEl.textContent = fallback
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