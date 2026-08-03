<div align="center">

# ⌨️ FLOKZ OBS Keyboard Overlay

**Overlay คีย์บอร์ดสำหรับ OBS — กดปุ่มจริงบนคีย์บอร์ด ปุ่มบนจอเล่นอนิเมชั่นกดตาม**
ให้ผู้ชมเห็นสดๆ ว่ากำลังกดปุ่มอะไรอยู่ พื้นหลังโปร่งใส วางทับฉากได้เลย

![Node](https://img.shields.io/badge/Node.js-18+-5FA04E?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-macOS%20·%20Windows-555)
![No build step](https://img.shields.io/badge/build-none%20·%20vanilla%20JS-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## ✨ ฟีเจอร์

- 🎹 **แสดงการกดปุ่มแบบ real-time** — hook คีย์บอร์ดระดับ OS จับได้แม้โฟกัสอยู่ในเกม
- 🧩 **จัดวางปุ่มอิสระ (free positioning)** — ลากปุ่มไปวางตรงไหนก็ได้ ลบปุ่มหนึ่งไม่ดันปุ่มอื่น
- 👥 **หลาย profile ต่อเครื่อง** — แต่ละ layout มี overlay URL ของตัวเอง สลับใช้ตามเกมได้
- 🖱️ **Editor บนเว็บ** — คลิก/ลากแก้ layout สดๆ ไม่ต้องแตะโค้ด บันทึกแล้ว overlay รีโหลดเอง
- 🎯 **Record keycode** — กดปุ่มจริงเพื่อผูกปุ่ม ไม่ต้องจำเลข keycode
- 🔒 **ทำงานในเครื่อง 100%** — keystroke ไม่วิ่งผ่านคลาวด์เลย
- 🪶 **ไม่มี build step** — vanilla JS/CSS ล้วน OBS โหลดตรงได้เลย

---

## 🧠 ทำไมต้องมี background service?

OBS Browser Source **รับ keyboard event ระดับ global ไม่ได้** — เวลาโฟกัสอยู่ที่เกมหรือแอปอื่น
หน้าเว็บใน OBS จะไม่ได้รับ event ใดๆ โปรเจกต์นี้จึงแยกเป็น 2 ส่วน: service เล็กๆ (Node.js)
คอย hook คีย์บอร์ดจาก OS แล้วส่ง event เข้า overlay ผ่าน WebSocket

```
┌──────────────────┐   uiohook   ┌───────────────┐  WebSocket  ┌────────────────────┐
│  คีย์บอร์ดจริง   │ ──────────▶ │  Node service │ ──────────▶ │  overlay ใน OBS    │
└──────────────────┘             └───────────────┘             └────────────────────┘
```

---

## 🚀 เริ่มใช้งาน

```bash
npm install
npm start
```

เปิดเบราว์เซอร์ไปที่ 👉 **http://localhost:3100**

| หน้า | URL |
| --- | --- |
| Overlay (สำหรับ OBS) | `http://localhost:3100` หรือ `http://localhost:3100/overlay/<id>` |
| Editor (ตั้งค่า) | `http://localhost:3100/editor.html` |

> 💡 เปลี่ยนพอร์ตได้ด้วย `PORT=4000 npm start`

### 🍎 macOS — ต้องอนุญาต Accessibility (สำคัญ!)

ถ้าไม่อนุญาต hook จะไม่ได้รับ event เลย (ปุ่มบนจอจะไม่ขยับ) — แต่ overlay ยังเสิร์ฟได้ปกติ

1. **System Settings → Privacy & Security → Accessibility**
2. เปิดสิทธิ์ให้ **Terminal** (หรือแอปที่ใช้รัน `npm start`)
3. ปิด–เปิด Terminal ใหม่ แล้ว `npm start` อีกครั้ง — ระบบจะเชื่อมต่อให้อัตโนมัติ

---

## 🎬 ตั้งค่าใน OBS

1. เปิด **http://localhost:3100/editor.html** → เลือก profile → กด **คัดลอก** ที่ช่อง Overlay URL
2. OBS: **Sources → ＋ → Browser**
3. **URL**: วาง overlay URL ที่คัดลอกมา (เช่น `http://localhost:3100/overlay/ab12cd`)
   หรือใช้ `http://localhost:3100` เฉยๆ = profile แรก
4. **Width / Height**: ตั้งให้พอดีกับคีย์บอร์ด (เช่น 900 × 400)
5. ปิด ☑️ **"Shutdown source when not visible"**
6. พื้นหลังโปร่งใสอยู่แล้ว วางทับฉากได้ทันที

---

## 🖌️ แก้ layout ผ่าน Editor (แนะนำ)

เปิด **http://localhost:3100/editor.html** ขณะ `npm start` ทำงานอยู่

<table>
<tr><td>

**คลิกปุ่มเพื่อแก้ไข** — inspector ทางขวาปรับได้:
- ป้าย (**label**) และ **keycode**
- ขนาด **กว้าง (w)** / **สูง (h)** เป็นหน่วยกริด
- ตำแหน่ง **X / Y** พิมพ์ตัวเลขวางเป๊ะๆ ได้

**ลากปุ่มเพื่อจัดตำแหน่งอิสระ**
- snap ทีละ 0.25 หน่วยให้เรียงสวย
- กด **Alt** ค้างขณะลาก = วางละเอียด

</td><td>

**เครื่องมืออื่น**
- **＋ เพิ่มปุ่ม** — เพิ่มปุ่มใหม่ที่แถวล่างสุด
- **🎯 Record** — กดแล้วกดปุ่มจริงบนคีย์บอร์ด ระบบจับ keycode ให้เอง
- แถบ **Profile** ด้านบน — สร้าง / เปลี่ยนชื่อ / ลบ profile + คัดลอก overlay URL
- **คืนค่าเริ่มต้น** — กลับไปใช้ layout default

</td></tr>
</table>

กด **บันทึก & ใช้งาน** → overlay ของ profile นั้น **รีโหลดเองอัตโนมัติ** (profile อื่นไม่กระทบ)
ค่าที่บันทึกทั้งหมดเก็บที่ `config/profiles.json`

---

## 👥 หลาย Profile

รองรับหลาย profile ต่อเครื่อง แต่ละอันมี layout และ overlay URL ของตัวเอง
(เช่น profile เกม A กับเกม B คนละหน้าตา) สลับใช้ได้อิสระ

- แต่ละ profile มี URL เช่น `http://localhost:3100/overlay/ab12cd`
- แก้ profile ไหน overlay ของ profile นั้นรีโหลดเอง profile อื่นไม่สะเทือน

---

## 🛠️ แก้ default layout ในโค้ด (ทางเลือก)

ค่า **default** (ใช้เมื่อ profile ยังว่าง) อยู่ในไฟล์ [`public/layout.js`](public/layout.js)

โมเดล layout เป็นแบบ **วางอิสระ**: layout คือ array แบนๆ ของปุ่ม แต่ละปุ่มมีพิกัดของตัวเอง

```js
{ code: KEY.W, label: 'W', x: 1, y: 2, w: 1, h: 1 }
```

| ฟิลด์ | ความหมาย |
| --- | --- |
| `code` | keycode ของ uiohook — ใช้ค่าจากตาราง `KEY` ในไฟล์ (เช่น `KEY.W`, `KEY.SPACE`) |
| `label` | ข้อความบนปุ่ม |
| `x`, `y` | ตำแหน่งเป็นหน่วยกริด (1 หน่วย = 1 ช่องปุ่ม) นับจากมุมซ้ายบน = `0,0` |
| `w`, `h` | ขนาดกว้าง/สูงเป็นหน่วย (ไม่ใส่ = 1) |

> default ในไฟล์ยังเขียนแบบ **แถว** ไว้เพื่ออ่านง่าย แล้วถูกแปลงเป็นพิกัดอัตโนมัติด้วย `toFreeLayout()`
> (layout แบบแถวรุ่นเก่าที่บันทึกไว้ก็ถูกแปลงให้เองตอนโหลด)

> 📌 ถ้า profile มี layout บันทึกไว้แล้วใน `config/profiles.json` overlay จะใช้ค่านั้นก่อน —
> `layout.js` ใช้เฉพาะตอน profile ยังว่าง กด **คืนค่าเริ่มต้น** ใน editor แล้วบันทึกเพื่อกลับมาใช้

---

## 🎨 ปรับสไตล์

แก้ CSS variables ที่หัวไฟล์ [`public/overlay.css`](public/overlay.css)

| ตัวแปร | ควบคุม |
| --- | --- |
| `--key-bg` | สีคีย์แคป (ตอนพัก) |
| `--key-text` | สีตัวหนังสือ |
| `--key-pressed-bg` | สีตอนกด |
| `--key-size` | ขนาดปุ่ม |
| `--key-gap` | ระยะห่างระหว่างปุ่ม |
| `--key-radius` | ความมนของมุม |

---

## 📁 โครงสร้างไฟล์

```
server/
  index.js       service: hook + WebSocket + static + profiles API + /overlay/:id
  hook.js        child process ทำ global keyboard hook (แยกไว้กันแครชลามถึง server)
public/
  index.html     หน้า overlay ที่ OBS โหลด (เสิร์ฟที่ / และ /overlay/<id>)
  overlay.js     หา profile จาก URL → โหลด layout → วางปุ่มตามพิกัด + animation
  overlay.css    ธีมคีย์แคป (พื้นโปร่งใส) + วางปุ่มแบบ absolute จากพิกัด x/y
  layout.js      ⭐ layout ค่าเริ่มต้น + ตาราง keycode + ตัวแปลง toFreeLayout
  editor.html    หน้า config (เปิด /editor.html)
  editor.js      ตรรกะ editor: จัดการ profile, คลิก/ลากวางปุ่มอิสระ, record, save
  editor.css     สไตล์หน้า editor
config/
  profiles.json  profile ทั้งหมด (สร้างอัตโนมัติ, ไม่ commit ขึ้น git)
```

---

## 📦 การกระจาย (Production)

ออกแบบให้เป็น **local app** ที่แต่ละคนรันบนเครื่องตัวเอง — keystroke ไม่ออกจากเครื่อง
เพราะ global key hook ต้องรันในเครื่อง จึงไม่ใช้โมเดลคลาวด์ ถ้าจะแพ็กเป็นเดสก์ท็อปแอปทีหลัง
(เช่น Electron / pkg) ก็ห่อ service นี้ได้เลย โครงสร้างไม่ต้องเปลี่ยน

---

<div align="center">
<sub>Made with ☕ for streamers · MIT License</sub>
</div>
