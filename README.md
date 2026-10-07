<div align="center">

# 🎬 FLOKZ Overlays

**ชุด overlay สำหรับ OBS — Talk (PNGtuber) + Grind counter**
Next.js 15 · shadcn/ui · deploy บน Vercel ได้

![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## ✨ เครื่องมือ

- 🗣️ **Talk (PNGtuber)** — avatar เปลี่ยนรูปตามเสียงไมค์ (พูด = ปากอ้า, เงียบ = ปากปิด) จับเสียงด้วย Web Audio API
- ⚔️ **Grind Counter** — จับภาพหน้าจอเกม นับรอบดันอัตโนมัติเมื่อเจอ “MISSION START” (template matching ใน Web Worker) แล้วโชว์จำนวนบนสตรีม
- ❤️ **Donation Alert** — เชื่อม **EasyDonate** (`read:donations`) โชว์ alert ตอนมีคนโดเนท (ชื่อ+ยอด+ข้อความ) อนิเมชั่น neon

ทั้งคู่ประมวลผล mic/ภาพ **ในเบราว์เซอร์** — overlay กับ OBS คุยกันผ่าน API (polling) โดยเก็บข้อมูลกลางไว้ที่ storage

---

## 🚀 รันในเครื่อง (dev)

```bash
nvm use            # node 22 (.nvmrc)  — ต้อง node ≥ 18.18
npm install
npm run dev        # → http://localhost:3100
```

ตอน dev **ไม่ต้องตั้ง storage** — ระบบ fallback ไปเก็บไฟล์ใน `./config` ให้เอง

| หน้า | URL | ใช้ทำอะไร |
| --- | --- | --- |
| หน้าแรก | `/` | เมนูรวม |
| ตั้งค่า Talk | `/talk-setup` | อัปโหลดรูป + ทดสอบไมค์ + ปรับความไว |
| Overlay Talk (ใส่ OBS) | `/talk` | avatar เปลี่ยนตามเสียง |
| ตัวนับ Grind | `/grind` | จับหน้าจอ + นับรอบ + สร้างลิงก์ OBS |
| Overlay Grind (ใส่ OBS) | `/grind-overlay/<token>` | โชว์จำนวนรอบ |
| ตั้งค่า Donation Alert | `/donate-setup` | วาง EasyDonate API key + ทดสอบ alert |
| Overlay Donation Alert (ใส่ OBS) | `/donate-alert` | โชว์ alert ตอนมีโดเนท |

> overlay ทุกอันพื้นหลังโปร่งใส เอา URL ไปวางใน OBS → Browser Source ได้เลย

### ❤️ Donation Alert (EasyDonate)
1. สร้าง API key (scope `read:donations`) ที่ [EasyDonate developer dashboard](https://easydonate.app/dashboard/developer?tab=apiKeys)
2. เปิด `/donate-setup` → วาง API key + ปรับยอดขั้นต่ำ/เวลาโชว์ → **บันทึก** (key เก็บฝั่ง server เท่านั้น)
3. กด **ส่ง alert ทดสอบ** เพื่อลอง (เห็น **preview ในหน้า setup เลย** + ได้ยินเสียงถ้าเปิด TTS) แล้วเอา `/donate-alert` ไปใส่ OBS
- **อ่านออกเสียง (TTS)** เปิด/ปิดได้ — ใช้ `SpeechSynthesis` ของเบราว์เซอร์ อ่าน "ชื่อ โดเนท ยอด บาท + ข้อความ" (เสียงไทยขึ้นกับ voice ที่เครื่อง/OBS มี)
- **Top Donors overlay** `/top-donors` — แถบอันดับยอดโดเนทรวม วิ่งวน (marquee) ไม่สะดุด; ปรับได้ด้วย query `?limit=10&speed=30&dir=right` (`dir=left` เลื่อนซ้าย)
- server proxy อ่านโดเนทแล้ว **cache 4s (ใน memory) กัน rate limit 60/นาที** ของ EasyDonate
- overlay อ่านโดเนทมาโชว์เท่านั้น — **การรับเงินจริงเกิดที่หน้า donation page ของ EasyDonate** (ไม่ได้ตัดเงินผ่านที่นี่)

---

## ☁️ Deploy บน Vercel

1. Push repo ขึ้น GitHub แล้ว **Import** เข้า Vercel (framework: Next.js — ไม่ต้องตั้งค่าอะไรพิเศษ)
2. ไปที่ **Storage → Create Database → Upstash (KV/Redis)** แล้ว **Connect** เข้า project
   นี้ — Vercel จะ inject env `KV_REST_API_URL` / `KV_REST_API_TOKEN` ให้อัตโนมัติ
3. **Redeploy** — เสร็จ เปิด `https://<your-app>.vercel.app`

> โค้ดตรวจ env เอง: มี `KV_REST_API_URL` → ใช้ Vercel KV, ไม่มี → เก็บไฟล์ (ใช้เฉพาะตอน dev)
> รูป avatar ถูกย่อ ≤ 700px แล้วเก็บเป็น data URL ใน KV — ถ้าไฟล์ใหญ่มากค่อยพิจารณาย้ายไป Vercel Blob

### ⚠️ เรื่องไมค์/จับหน้าจอใน OBS
Browser Source ต้องได้รับอนุญาต mic/screen ถ้าใน OBS ไม่ทำงาน ให้เปิดหน้า overlay ใน
**เบราว์เซอร์ปกติ** แล้วใช้ **Window Capture** แทน (บน https/localhost เบราว์เซอร์อนุญาตให้อยู่แล้ว)

---

## 🧱 Stack & โครงสร้าง

- **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui** ธีม dark neon
- ไม่มี custom server / WebSocket แล้ว — overlay ใช้ **polling** ผ่าน API (Vercel-friendly)
- `app/(dash)/` หน้า config (navbar) · `app/(overlay)/` overlay โปร่งใส · `app/api/{talk,grind}` เก็บ/อ่านค่า
- `lib/kv.ts` storage 2 โหมด (Vercel KV / ไฟล์) · `lib/detector.ts` template matcher · `app/(dash)/grind/scan.worker.ts` worker
