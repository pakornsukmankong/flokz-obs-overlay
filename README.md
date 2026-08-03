# FLOKZ OBS Keyboard Overlay

Overlay สำหรับ OBS ที่แสดงคีย์บอร์ดบนหน้าจอ และเมื่อกดปุ่มจริง ปุ่มนั้นจะเล่นอนิเมชั่นกด — ให้ผู้ชมเห็นว่ากำลังกดปุ่มอะไร

## ทำไมต้องมี background service?

OBS Browser Source **รับ keyboard event ระดับ global ไม่ได้** เวลาโฟกัสอยู่ที่เกม/แอปอื่น
โปรเจ็คนี้จึงมี background service (Node.js) คอย hook คีย์บอร์ดจาก OS แล้วส่ง event เข้า overlay ผ่าน WebSocket

```
[ คีย์บอร์ดจริง ] → uiohook → [ Node service ] → WebSocket → [ overlay ใน OBS ]
```

## ติดตั้ง

```bash
npm install
```

## รัน

```bash
npm start
```

จะได้ overlay ที่ **http://localhost:3000**

### macOS — ต้องอนุญาต Accessibility (สำคัญ!)

ถ้าไม่อนุญาต hook จะไม่ได้รับ event (ปุ่มจะไม่ขยับ)

1. System Settings → Privacy & Security → **Accessibility**
2. เปิดสิทธิ์ให้ **Terminal** (หรือแอปที่ใช้รัน `npm start`)
3. ปิด–เปิด Terminal ใหม่ แล้วรัน `npm start` อีกครั้ง

## หลาย profile + overlay URL

รองรับ **หลาย profile ต่อเครื่อง** แต่ละอันมี layout และ overlay URL ของตัวเอง
(เช่น profile เกม A กับเกม B คนละหน้าตา) — keystroke อยู่ในเครื่อง 100% ไม่วิ่งผ่านคลาวด์

- เปิดหน้า editor → ใช้แถบ **Profile** ด้านบนเพื่อ สร้าง/เปลี่ยนชื่อ/ลบ profile
- แต่ละ profile มี **Overlay URL** เช่น `http://localhost:3000/overlay/ab12cd` — กด **คัดลอก** เอาไปใส่ OBS
- แก้ profile ไหน overlay ของ profile นั้นรีโหลดเอง (profile อื่นไม่กระทบ)

## ตั้งค่าใน OBS

1. เปิด editor → เลือก profile → กด **คัดลอก** ที่ช่อง Overlay URL
2. OBS: Sources → **+** → **Browser**
3. URL: วาง overlay URL ที่คัดลอกมา (เช่น `http://localhost:3000/overlay/ab12cd`)
   - หรือใช้ `http://localhost:3000` เฉยๆ = profile แรก
4. Width / Height: ตั้งให้พอดีกับคีย์บอร์ด (เช่น 900 × 400)
5. ปิด **"Shutdown source when not visible"**
6. พื้นหลังโปร่งใสอยู่แล้ว วางทับฉากได้เลย

## ปรับ layout ปุ่ม — ผ่านหน้าเว็บ Editor (แนะนำ)

เปิด **http://localhost:3000/editor.html** ในเบราว์เซอร์ (ตอน `npm start` อยู่)

- เห็นพรีวิวคีย์บอร์ดสดๆ บนพื้นตารางหมากรุก (แทนพื้นโปร่งใสของ OBS)
- **คลิกปุ่ม** เพื่อแก้ไข: เปลี่ยน label, ปรับความกว้าง, เลือก keycode
- **ลากปุ่มเพื่อจัดตำแหน่ง** — ลากได้ทั้งภายในแถวและข้ามแถว (มีเส้นบอกตำแหน่งที่จะวาง)
- **ลากที่จับ ⠿** ทางซ้ายของแถว เพื่อย้ายทั้งแถวขึ้น/ลง
- **🎯 Record** — กดปุ่มนี้แล้วกดปุ่มจริงบนคีย์บอร์ด ระบบจับ keycode ให้อัตโนมัติ
  (ต้องมีสิทธิ์ Accessibility)
- แถบเครื่องมือซ้ายของแต่ละแถว: เพิ่มปุ่ม (＋), เพิ่มช่องว่าง (␣), ลบแถว (🗑)
- แถบ **Profile** ด้านบน: เลือก/สร้าง/เปลี่ยนชื่อ/ลบ profile + คัดลอก overlay URL
- กด **บันทึก & ใช้งาน** → overlay ของ profile นั้น **รีโหลดเองอัตโนมัติ** ไม่ต้อง refresh มือ

ค่าที่บันทึกทั้งหมดเก็บที่ `config/profiles.json`

## ปรับ layout ปุ่ม — แก้ไฟล์เอง (ทางเลือก)

ค่า **default** (ตอน profile ยังว่าง) อยู่ในไฟล์ [`public/layout.js`](public/layout.js) —
default ปัจจุบันเป็นคีย์บอร์ดสีฟ้าพาสเทล มีแถวเลข 1-0 + QWERTY + Space

- `LAYOUT` = array ของแถว, แต่ละแถวเป็น array ของปุ่ม
- แต่ละปุ่ม: `{ code, label, width }`
  - `code` — keycode (ใช้ค่าจากตาราง `KEY` ในไฟล์ เช่น `KEY.W`, `KEY.SPACE`)
  - `label` — ข้อความบนปุ่ม
  - `width` — ความกว้าง (1 = ปกติ, ไม่ใส่ = 1)
- เว้นช่องว่าง: `{ spacer: 0.5 }`

> หมายเหตุ: ถ้า profile มี layout ที่บันทึกไว้แล้ว (ใน `config/profiles.json`) overlay จะใช้ค่านั้นก่อน
> `layout.js` เป็นค่า default ที่ใช้เฉพาะตอน profile ยังว่าง — กด "คืนค่าเริ่มต้น" ใน editor แล้วบันทึกเพื่อกลับมาใช้

## ปรับสไตล์

แก้ CSS variables ที่หัวไฟล์ [`public/overlay.css`](public/overlay.css) — สีคีย์แคป (`--key-bg`),
สีตัวหนังสือ (`--key-text`), สีตอนกด (`--key-pressed-bg`), ขนาดปุ่ม (`--key-size`), ความมน (`--key-radius`)

## โครงสร้างไฟล์

```
server/index.js      service: hook + WebSocket + static + profiles API + /overlay/:id
server/hook.js       child process ที่ทำ global keyboard hook (แยกกันแครช)
public/index.html    หน้า overlay ที่ OBS โหลด (เสิร์ฟที่ / และ /overlay/<id>)
public/overlay.js    หา profile จาก URL + โหลด layout + render + animation
public/overlay.css   ธีมคีย์แคปฟ้าพาสเทล (พื้นโปร่งใส)
public/layout.js     ⭐ layout ค่าเริ่มต้น + ตาราง keycode
public/editor.html   หน้า config (เปิด /editor.html)
public/editor.js     ตรรกะ editor (จัดการ profile, แก้ปุ่ม, record, save)
public/editor.css    สไตล์หน้า editor
config/profiles.json profile ทั้งหมด (สร้างอัตโนมัติ, ไม่ commit)
```
