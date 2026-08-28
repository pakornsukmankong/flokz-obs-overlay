# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

FLOKZ Overlays — OBS overlay 3 ตัว: **talk** (PNGtuber เปลี่ยนรูปตามเสียงไมค์),
**grind** (นับรอบดันจากการจับภาพหน้าจอ), **donate** (alert โดเนทจาก EasyDonate).

Stack: **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui** ธีม dark neon.
**Deploy บน Vercel ได้** — เป็น Next.js ธรรมดา (ไม่มี custom server / WebSocket / native module).

> เดิมมีฟีเจอร์ keyboard overlay (uiohook + custom WS server) แต่ **ถอดออกแล้ว** เพราะรันบน
> cloud ไม่ได้ (ต้องมีคีย์บอร์ดจริง). ประวัติอยู่ใน git.

## Architecture

overlay (ใน OBS) กับหน้า config เป็นคนละเบราว์เซอร์ → คุยกันผ่าน **API + polling** (ไม่ใช้ realtime):

- **Talk**: `/talk-setup` อัปโหลดรูป (ย่อ ≤700px เป็น data URL) + ปรับ threshold/hold → `POST /api/talk`.
  `/talk` (overlay) โหลด config, เปิดไมค์ (Web Audio RMS), rms>threshold → สลับรูป, **poll `/api/talk` ทุก 3s**.
- **Grind**: `/grind` จับหน้าจอ (getDisplayMedia) → detect "MISSION START" (template matching ใน
  module worker `app/(dash)/grind/scan.worker.ts`) → นับรอบ → **`POST /api/grind` {token,count}** ทุกครั้งที่
  count เปลี่ยน + heartbeat 5s. `/grind-overlay/[token]` (overlay) **poll `GET /api/grind?token=` ทุก 1.5s**
  โชว์เลข (จุด live เขียวถ้า `at` สดกว่า 20s). count เก็บใน localStorage ของหน้า counter ด้วย.

- **Donate**: `/donate-setup` วาง EasyDonate API key (scope `read:donations`) → เก็บใน KV (ฝั่ง server, ไม่โผล่ client).
  `/api/easydonate/donations` proxy อ่านโดเนท (`lib/easydonate.ts`, **cache 4s** กัน rate limit 60/นาที) + รวม
  "โดเนททดสอบ" จากปุ่มทดสอบ. `/donate-alert` (overlay) **poll ทุก 3s**, dedupe ด้วย id (localStorage `flokz.donate.seen`),
  โดเนทใหม่ที่มาหลัง first-poll → เข้า queue เล่นทีละอัน (first-poll ไม่เล่นประวัติเก่า). รับเงินจริงเกิดที่หน้า EasyDonate — เราแค่อ่าน.
  - **Top Donors**: `/top-donors` (overlay) marquee เลื่อนวน — `GET /api/easydonate/top?limit=` รวมยอดต่อคนจากโดเนทที่ดึงได้
    แล้วจัดอันดับ. loop ไร้รอยต่อด้วยการ render list ซ้ำ (≥8 ชิ้น) แล้ว double + `translateX 0↔-50%`. query: `limit/speed/dir(left|right)`.

## Storage — `lib/kv.ts` (2 โหมด)

- มี env `KV_REST_API_URL` (บน Vercel) → ใช้ **Vercel KV** (`@vercel/kv`, dynamic import)
- ไม่มี env (dev ในเครื่อง) → เขียนไฟล์ JSON ใน `./config` (zero-setup)
- keys: `talk` (config), `grind:<token>` (state, TTL 1 วัน), `donate:config`/`donate:cache`/`donate:test`

## โครงสร้าง

- `app/(dash)/` — หน้า config มี navbar + ธีม neon (`layout.tsx`); `page.tsx` (landing), `talk-setup/`, `grind/`, `donate-setup/`
- `app/(overlay)/` — overlay OBS พื้นโปร่งใส ไม่มี chrome (`layout.tsx` ว่าง; body โปร่งใสจาก globals.css)
  - `talk/`, `grind-overlay/[token]/`, `donate-alert/`, `top-donors/` — URL: `/talk`, `/grind-overlay/<token>`, `/donate-alert`, `/top-donors`
- `app/api/` — `talk/`, `grind/`, `easydonate/{config,donations,test,top}/route.ts`
- `lib/` — `kv.ts` (storage), `detector.ts` (template matcher), `easydonate.ts` (proxy+cache), `utils.ts`
- `components/` — `navbar.tsx`, `ui/` (shadcn)
- `config/` — ไฟล์ JSON ตอน dev (git-ignored, auto-created)

## Conventions

- คอมเมนต์/ข้อความผู้ใช้เป็นภาษาไทย — คงสไตล์นี้
- Overlay ต้องพื้นโปร่งใส (ธีม neon ใช้เฉพาะ `.neon-bg` ในกลุ่ม dash — body โปร่งใสเสมอ)
- `grind-overlay` ใช้ `useSearchParams` → ต้องอยู่ใน `<Suspense>` (build ถึงจะผ่าน)
- module worker โหลดด้วย `new Worker(new URL('./scan.worker.ts', import.meta.url))`

## Run / build / deploy

```bash
nvm use && npm install
npm run dev            # → http://localhost:3100 (file storage, ไม่ต้องตั้ง KV)
npm run build && npm start
```
Vercel: Import repo → Storage → connect Upstash KV → redeploy (ดู README)

## Gotchas

- getDisplayMedia (grind) / getUserMedia (talk) ต้องเป็นแท็บเบราว์เซอร์จริง (https/localhost);
  ถ้าใน OBS ไม่ทำงาน ให้เปิดใน browser ปกติแล้วใช้ Window Capture
- อัปเดต overlay ไม่ทันที (polling 1.5–3s) — เหมาะกับ counter/avatar อยู่แล้ว
- รูป avatar เก็บเป็น data URL ใน KV; ถ้าใหญ่เกิน limit ของ KV ให้ย้ายไป Vercel Blob
