# 🐺 Werewolf Online

Social Deduction เว็บเกมหมาป่า เล่นผ่านมือถือ/คอมพิวเตอร์  
Public 5–16 คน — ฟรี 100% ด้วย Firebase + Netlify

---

## Setup Firebase

1. ไปที่ [Firebase Console](https://console.firebase.google.com)
2. สร้างโปรเจคใหม่ → ปิด Google Analytics
3. ไปที่ **Authentication** → **Sign-in method**
   - เปิด **Anonymous** ให้เป็น Enabled แล้ว Save
4. ไปที่ **Realtime Database** → **Create Database**
   - เลือกโซนใกล้ไทย เช่น `asia-southeast1`
   - เริ่มต้นด้วย **Start in test mode**
   - อัปโหลด `firebase-rules.json` แทนที่กฎเริ่มต้น
5. ไปที่ **Project Settings** → **General**
   - กด **Add app** → **Web** (`</>`)
   - คัดลอก `firebaseConfig` ทั้งก้อน
6. เปิด `src/firebase.js`
   - วาง `firebaseConfig` ลงในตัวแปร `firebaseConfig`

## Setup Netlify

1. ไปที่ [Netlify](https://app.netlify.com)
2. กด **Add new site** → **Deploy manually**
3. ลากโฟลเดอร์โปรเจคนี้ (ทั้งโปรเจค) วางลงไป
4. รอ deploy เสร็จ (ใช้เวลาไม่กี่วินาที)
5. Netlify จะสุ่ม URL ให้ → จดไว้หรือตั้ง Domain เองได้

### Auto-deploy (Git)

1. Push โปรเจคไป GitHub/GitLab
2. ใน Netlify กด **Add new site** → **Import from Git**
3. เลือก repo → Branch: `main` → **Deploy site**
4. Netlify จะ build + deploy อัตโนมัติทุกครั้งที่ push

---

## โครงสร้างไฟล์

```
├── index.html          # หน้าแรก
├── lobby.html          # หน้า Lobby
├── host.html           # หน้าคนทรง
├── player.html         # หน้าผู้เล่น
├── end.html            # หน้าจบเกม
├── spectator.html      # หน้า Spectator
├── settings.html       # หน้า Settings
├── help.html           # หน้า Help/กติกา
├── profile.html        # หน้า Profile
├── src/
│   ├── firebase.js     # Firebase config
│   ├── game.js         # ลอจิกเกม
│   ├── roles.js        # นิยามบทบาท
│   ├── win-check.js    # เช็กเงื่อนไขชนะ
│   ├── vote.js         # ระบบโหวต
│   ├── night.js        # ระบบกลางคืน
│   ├── host-control.js # ระบบคนทรง
│   └── style.css       # CSS
├── assets/
│   ├── roles/          # ไอคอน Role (.png)
│   ├── ui/             # ไอคอน UI
│   └── bg/             # พื้นหลัง
├── README.md
└── firebase-rules.json # Security Rules
```

---

## เทคโนโลยี

- **Hosting:** Netlify (static site)
- **Auth:** Firebase Anonymous Auth
- **Database:** Firebase Realtime Database
- **Frontend:** Vanilla JS — ไม่มี Framework