# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

FLOKZ Overlays — OBS overlay 2 ตัว: **talk** (PNGtuber เปลี่ยนรูปตามเสียงไมค์) และ
**grind** (นับรอบดันจากการจับภาพหน้าจอ). mic/ภาพ ประมวลผลในเบราว์เซอร์ทั้งหมด.

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

## Storage — `lib/kv.ts` (2 โหมด)

- มี env `KV_REST_API_URL` (บน Vercel) → ใช้ **Vercel KV** (`@vercel/kv`, dynamic import)
- ไม่มี env (dev ในเครื่อง) → เขียนไฟล์ JSON ใน `./config` (zero-setup)
- keys: `talk` (config), `grind:<token>` (state, TTL 1 วัน)

## โครงสร้าง

- `app/(dash)/` — หน้า config มี navbar + ธีม neon (`layout.tsx`); `page.tsx` (landing), `talk-setup/`, `grind/`
- `app/(overlay)/` — overlay OBS พื้นโปร่งใส ไม่มี chrome (`layout.tsx` ว่าง; body โปร่งใสจาก globals.css)
  - `talk/`, `grind-overlay/[token]/` — URL คงเดิม: `/talk`, `/grind-overlay/<token>`
- `app/api/` — `talk/route.ts` (GET/POST), `grind/route.ts` (GET ?token / POST {token,count})
- `lib/` — `kv.ts` (storage), `detector.ts` (template matcher, framework-free), `utils.ts`
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
