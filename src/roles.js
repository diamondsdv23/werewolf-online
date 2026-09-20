const ROLES = {
  villager: {
    id: 'villager',
    nameTh: 'ชาวบ้าน',
    nameEn: 'Villager',
    team: 'villager',
    icon: 'villager.png',
    desc: 'ไม่มีพลังพิเศษ ใช้การสังเกต พูดคุย หาข้อมูล และโหวตกำจัดหมาป่า',
  },
  seer: {
    id: 'seer',
    nameTh: 'ผู้หยั่งรู้',
    nameEn: 'Seer',
    team: 'villager',
    icon: 'seer.png',
    desc: 'ทุกคืนตรวจสอบผู้เล่น 1 คน ว่ารวมกลุ่มหมาป่าหรือไม่',
  },
  aura_seer: {
    id: 'aura_seer',
    nameTh: 'ผู้หยั่งรู้ออร่า',
    nameEn: 'Aura Seer',
    team: 'villager',
    icon: 'aura_seer.png',
    desc: 'ทุกคืนตรวจสอบผู้เล่น 1 คน และรู้บทบาทที่แท้จริงของคนนั้น',
  },
  doctor: {
    id: 'doctor',
    nameTh: 'หมอ',
    nameEn: 'Doctor',
    team: 'villager',
    icon: 'doctor.png',
    desc: 'ทุกคืนเลือกปกป้อง 1 คนจากหมาป่ากัด ซ้ำคนเดิมได้ แต่ห้ามปกป้องตัวเอง',
  },
  bodyguard: {
    id: 'bodyguard',
    nameTh: 'บอดี้การ์ด',
    nameEn: 'Bodyguard',
    team: 'villager',
    icon: 'bodyguard.png',
    desc: 'ทุกคืนเลือกปกป้อง 1 คนจากหมาป่ากัด ปกป้องตัวเองได้ แต่ห้ามซ้ำคนเดิมจากคืนก่อน',
  },
  hunter: {
    id: 'hunter',
    nameTh: 'นายพราน',
    nameEn: 'Hunter',
    team: 'villager',
    icon: 'hunter.png',
    desc: 'ตายกลางคืน → เปิดบทบาทเช้าวันถัดไป + ยิง 1 คนทันที / ตายกลางวัน → เปิดบทบาท + ยิงทันที',
  },
  witch: {
    id: 'witch',
    nameTh: 'พ่อมด/แม่มด',
    nameEn: 'Witch',
    team: 'villager',
    icon: 'witch.png',
    desc: 'มียาพิษ 1 ครั้ง + ยาป้องกันชีวิต 1 ครั้ง (กันหมาป่ากัด ใช้กับตัวเองได้) ห้ามใช้พร้อมกัน',
  },
  cupid: {
    id: 'cupid',
    nameTh: 'คิวปิด',
    nameEn: 'Cupid',
    team: 'villager',
    icon: 'cupid.png',
    desc: 'คืนแรก เลือกคู่รัก 2 คน ถ้าคนหนึ่งตาย อีกคนตายตามทันที',
  },
  mayor: {
    id: 'mayor',
    nameTh: 'นายกเทศมนตรี',
    nameEn: 'Mayor',
    team: 'villager',
    icon: 'mayor.png',
    desc: 'กลางวันเลือกเปิดตัววันไหนก็ได้ หลังเปิดตัวแล้วโหวตได้ 2 เสียงตลอด',
  },
  mason: {
    id: 'mason',
    nameTh: 'ช่างก่ออิฐ',
    nameEn: 'Mason',
    team: 'villager',
    icon: 'mason.png',
    desc: 'มีทั้งหมด 2 คน รู้จักกัน รู้ว่าอีกคนเป็น Mason และเป็นฝ่ายดี',
  },
  diseased: {
    id: 'diseased',
    nameTh: 'ผู้ติดโรค',
    nameEn: 'Diseased',
    team: 'villager',
    icon: 'diseased.png',
    desc: 'ถ้าถูกหมาป่าฆ่า หมาป่าป่วย ฆ่าใครไม่ได้ในคืนถัดไป',
  },
  insomniac: {
    id: 'insomniac',
    nameTh: 'คนนอนไม่หลับ',
    nameEn: 'Insomniac',
    team: 'villager',
    icon: 'insomniac.png',
    desc: 'ไม่มีพลังพิเศษ ชนะเมื่อฝ่ายชาวบ้านชนะ',
  },
  cursed: {
    id: 'cursed',
    nameTh: 'ผู้ต้องสาป',
    nameEn: 'Cursed',
    team: 'villager',
    icon: 'cursed.png',
    desc: 'เริ่มเป็นชาวบ้าน กลางคืนเมื่อคนทรงเรียก ระบบจะแจ้งสถานะทันที ถ้าถูกหมาป่ากัดจะกลายเป็นหมาป่า',
  },
  werewolf: {
    id: 'werewolf',
    nameTh: 'หมาป่า',
    nameEn: 'Werewolf',
    team: 'wolf',
    icon: 'werewolf.png',
    desc: 'เห็นหมาป่าด้วยกัน เลือกเหยื่อร่วมกันทุกคืน แต่ไม่มีแชทระหว่างกัน',
  },
  wolf_cub: {
    id: 'wolf_cub',
    nameTh: 'ลูกหมาป่า',
    nameEn: 'Wolf Cub',
    team: 'wolf',
    icon: 'wolf_cub.png',
    desc: 'เมื่อถูกฆ่า (ทุกวิธี) คืนถัดไปหมาป่าจะฆ่าได้ 2 คน (คนละคน)',
  },
  sorceress: {
    id: 'sorceress',
    nameTh: 'แม่มดหมาป่า',
    nameEn: 'Sorceress',
    team: 'wolf',
    icon: 'sorceress.png',
    desc: 'ทุกคืนตรวจ 1 คนว่ารวมกลุ่ม Seer หรือไม่ ร่วมฆ่ากับหมาป่า รู้จักหมาป่าคนอื่น',
  },
  minion: {
    id: 'minion',
    nameTh: 'สมุน',
    nameEn: 'Minion',
    team: 'wolf',
    icon: 'minion.png',
    desc: 'รู้ว่าหมาป่าคือใคร แต่หมาป่าไม่รู้จักเรา ไม่ร่วมฆ่า นับเป็นหมาป่าในเงื่อนไขชนะ',
  },
  fool: {
    id: 'fool',
    nameTh: 'คนโง่',
    nameEn: 'Fool',
    team: 'neutral',
    icon: 'fool.png',
    desc: 'ชนะเมื่อถูกโหวตออกเท่านั้น → เกมจบทันที ไม่งั้นแพ้เสมอ',
  },
}

const TEAMS = {
  villager: { nameTh: 'ฝ่ายชาวบ้าน', color: '#16a34a' },
  wolf: { nameTh: 'ฝ่ายหมาป่า', color: '#dc2626' },
  neutral: { nameTh: 'ฝ่ายเป็นกลาง', color: '#64748b' },
}

const WOLF_ROLES = ['werewolf', 'wolf_cub', 'sorceress', 'minion']

const SPECIAL_MAX = {
  seer: 1,
  aura_seer: 1,
  doctor: 1,
  bodyguard: 1,
  hunter: 1,
  witch: 1,
  cupid: 1,
  mayor: 1,
  diseased: 1,
  insomniac: 1,
  cursed: 1,
  fool: 1,
  wolf_cub: 1,
  sorceress: 1,
  minion: 1,
}

function isWolfRole(roleId) {
  return WOLF_ROLES.includes(roleId)
}

function isVillagerSide(roleId) {
  if (!ROLES[roleId]) return false
  return ROLES[roleId].team !== 'wolf'
}

function getRole(id) {
  return ROLES[id] || null
}

function getTeam(roleId) {
  const role = ROLES[roleId]
  return role ? TEAMS[role.team] : null
}

function allRoleIds() {
  return Object.keys(ROLES)
}