# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

FLOKZ Overlay Suite — เครื่องมือ overlay สำหรับ OBS 3 ตัว: **keyboard** (คีย์เด้งตามที่กดจริง),
**talk** (PNGtuber เปลี่ยนรูปตามเสียงไมค์), **grind** (นับรอบดันจากการจับภาพหน้าจอ)
keystroke/เสียง/ภาพ ประมวลผลในเครื่องทั้งหมด ไม่ส่งออกไปไหน

Stack: **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui** ธีม dark neon
เสิร์ฟด้วย **custom server** (`server.js`) ที่รวม Next + WebSocket + uiohook เข้าเป็น process เดียว

## Architecture (สำคัญ)

OBS Browser Source รับ global keyboard input ไม่ได้ + Next App Router เพียวๆ รัน WebSocket/native hook ไม่ได้
→ ใช้ **custom Next server**:

- **`server.js`** — createServer + Next handler; แนบ `ws` แบบ `noServer` แล้ว route `upgrade`:
  `/_next/*` → `app.getUpgradeHandler()` (HMR ของ Next), ที่เหลือ → wss ของเรา.
  - **สำคัญ 2 จุด (เคยพังมาก่อน):**
    1. Next dev แอบเพิ่ม `upgrade` listener ของตัวเองแบบ lazy → ต้องกันด้วย `newListener`
       ให้เหลือ listener ของเราตัวเดียว ไม่งั้น socket โดน destroy (1006) + HMR frame เพี้ยน
    2. `perMessageDeflate: false` — บาง proxy ทำเฟรมบีบอัดเพี้ยน
  - hub (broadcast / reloadProfile / relayGrind / talkReload) วางไว้บน `globalThis.__FLOKZ_HUB`
    ให้ Route Handler เข้าถึง instance เดียวกัน (`lib/ws-hub.ts` เป็นตัวเรียก)
  - spawn `server/hook.js` (uiohook child — ไม่เปลี่ยนจากเดิม) respawn ทุก 3s ถ้ายังไม่ได้สิทธิ์ Accessibility
- **`server/hook.js`** — child process รัน uiohook ส่ง `{type:down|up,keycode}` กลับ parent ผ่าน `process.send`
- รัน: `npm run dev` / `npm start` = `node server.js` (**ต้อง node ≥18.18**; repo ใช้ nvm v22 — มี `.nvmrc`)

## โครงสร้าง

- **`app/(dash)/`** — หน้า config มี navbar + ธีม neon (`layout.tsx` = navbar + `.neon-bg` + Toaster)
  - `page.tsx` (landing), `keyboard/`, `talk-setup/`, `grind/` (+ `grind/scan.worker.ts` module worker)
- **`app/(overlay)/`** — overlay สำหรับ OBS: พื้นโปร่งใส ไม่มี chrome (`layout.tsx` ว่าง; body โปร่งใสจาก globals)
  - `overlay/[id]/` (keyboard), `talk/` (PNGtuber), `grind-overlay/[token]/`
  - route group `(name)` ไม่มีผลกับ URL → OBS URL: `/overlay/<id>`, `/talk`, `/grind-overlay/<token>`
- **`app/api/`** — Route Handlers: `profiles/`, `profiles/[id]/` (PUT → reloadProfile), `talk/` (POST → talkReload)
- **`lib/`** — `store.ts` (profiles.json), `talk-store.ts` (talk.json), `ws-hub.ts`,
  `keyboard.ts` (KEY table + toFreeLayout + DEFAULT_LAYOUT), `detector.ts` (template matcher), `utils.ts`
- **`components/`** — `navbar.tsx`, `keyboard-view.tsx` + `keyboard.module.css` (keycap), `ui/` (shadcn)
- **`config/`** — `profiles.json`, `talk.json` (git-ignored, auto-created)

## Data model / WS protocol (คงเดิมจากเวอร์ชัน vanilla)

- **Keyboard layout** = flat array `{ code, label, x, y, w, h }` (พิกัดหน่วยกริด, วางอิสระ).
  `lib/keyboard.ts#toFreeLayout` normalize (รับได้ทั้งรูปแถวเก่าและ flat). profile layout ว่าง → ใช้ `DEFAULT_LAYOUT`
- **Talk** = `{ talking, idle (data URLs), threshold, hold }`
- **Grind** = client-side ล้วน; count อยู่ใน localStorage ของหน้า `/grind`; ส่งไป overlay ผ่าน WS token relay
- **WS messages**: `hello{profile}` / `down` / `up` / `reload` (keyboard) · `talk-reload` ·
  `grind-hello{token}` / `grind-state{token,count,…}` (relay เฉพาะ `_grindToken` ตรงกัน)

## Conventions

- **Keycodes เป็น uiohook codes ไม่ใช่ `KeyboardEvent.code`** (ตาราง `KEY` ใน `lib/keyboard.ts`)
- คอมเมนต์/ข้อความผู้ใช้เป็นภาษาไทย — คงสไตล์นี้
- Overlay ต้องพื้นโปร่งใส (ธีม neon ใช้เฉพาะ `.neon-bg` ในกลุ่ม dash — body โปร่งใสเสมอ)
- shadcn components อยู่ใน `components/ui/` (เพิ่มด้วย `npx shadcn add …`)

## Run / build

```bash
nvm use            # node 22 (.nvmrc)
npm install
npm run dev        # → http://localhost:3100 (custom server + HMR)
npm run build && npm start   # production
```
macOS: เปิดสิทธิ์ **Accessibility** ให้ Terminal ที่รัน node ไม่งั้นคีย์ไม่ขยับ (overlay ยังเสิร์ฟปกติ)

## Gotchas

- WebSocket ต้องรันผ่าน `server.js` เท่านั้น — `next dev`/`next start` เดี่ยวๆ ไม่มี WS/hook
- getDisplayMedia (grind) + getUserMedia (talk) ต้องเป็นแท็บเบราว์เซอร์จริง; ใน OBS ถ้าไมค์/จอไม่ทำงาน
  ให้เปิดใน browser ปกติแล้วใช้ Window Capture
- module worker โหลดด้วย `new Worker(new URL('./scan.worker.ts', import.meta.url))` (webpack bundle ให้)
