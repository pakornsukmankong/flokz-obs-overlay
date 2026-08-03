# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

OBS keyboard overlay: shows a keyboard on screen and animates each key when the
user **physically** presses it. Meant to be added to OBS as a Browser Source.

## Architecture (important)

An OBS Browser Source **cannot receive global keyboard input** — when focus is on
a game or another app, the page gets no key events. So the project is split in two:

```
[ physical keyboard ] → uiohook → [ Node service ] → WebSocket → [ overlay page in OBS ]
```

- **`server/index.js`** — the main service:
  1. Serves `public/` over HTTP; also serves `index.html` for `/overlay/<id>`.
  2. **Profiles API** (persisted to `config/profiles.json`):
     `GET/POST /api/profiles`, `GET/PUT/DELETE /api/profiles/:id`. Each profile is
     `{ id, name, layout }`. Store auto-seeds a "Default" profile on first read
     (migrating a legacy `config/layout.json` if present); it persists immediately so
     ids/URLs stay stable.
  3. Runs a WebSocket server on the same HTTP server. Key events (`down`/`up`)
     broadcast to **all** overlays. A profile PUT calls `reloadProfile(id)` which
     sends `reload` only to sockets whose `_profile === id` (set via the overlay's
     `hello` message on connect) — so editing one profile doesn't reload others.
  4. Spawns `server/hook.js` as a **child process** (see below).

- **`server/hook.js`** — child process that runs the `uiohook-napi` global hook and
  forwards `{ type: 'down'|'up', keycode }` to the parent via `process.send`.
  De-dupes OS key-repeat via a `pressed` Set. **It is isolated on purpose:** without
  macOS Accessibility permission uiohook calls a native `abort()` that kills its
  process; isolating it keeps the static/WebSocket server alive, and index.js
  respawns it every 3s so it connects automatically once permission is granted.

- **`public/`** — overlay + editor pages (vanilla JS/CSS, no framework, no build step):
  - **Layout model = free positioning.** A layout is a **flat array of keys**, each
    `{ code, label, x, y, w, h }` where `x,y` are **grid-unit coordinates** (1 unit =
    one key step = `--key-size + --key-gap`) from the top-left, and `w,h` are size in
    units (default 1). Every key is placed absolutely, so deleting/moving one key never
    reflows the others. (Legacy **row** layouts — nested arrays of `{ code, label, width }`
    / `{ spacer }` — are auto-migrated to coordinates; see `toFreeLayout` below.)
  - `layout.js` — the **default** layout + keycode table (used when a profile's layout
    is empty). The default is authored as readable **rows** for legibility, then
    `toFreeLayout()` converts it to the flat coordinate form. `KEY` is the uiohook
    keycode table. Exposes `window.OVERLAY_LAYOUT` (already-migrated default),
    `window.OVERLAY_TO_FREE` (the `toFreeLayout` normalizer, idempotent — used by
    overlay.js/editor.js on any loaded profile), and `window.OVERLAY_KEYS`.
  - `overlay.js` — reads the profile id from `/overlay/<id>` (else uses the first
    profile), fetches that profile's layout (falls back to `OVERLAY_LAYOUT` if empty),
    normalizes via `OVERLAY_TO_FREE`, places each key absolutely by `--x/--y/--w/--h`,
    and sets `--cols/--rows` on `.keyboard` (= max `x+w` / `y+h`) so the box hugs the
    keys. Connects the WebSocket, sends `{type:'hello',profile}`, toggles `.pressed`,
    reloads on a `reload` message.
  - `overlay.css` — pastel-blue keycap theme, transparent background. Theme knobs are
    CSS variables at the top (`--key-bg`, `--key-text`, `--key-pressed-bg`, …).
    `--cell = --key-size + --key-gap` is one grid unit; `.keyboard` is `position:relative`
    sized from `--cols/--rows`, and each `.key` is `position:absolute` at
    `left/top = x/y × --cell`. The `.keyboard` fixed bottom-center positioning lives
    under `body.pin-bottom` (overlay page only) so the editor can embed a static inline
    preview. Assets are referenced with **absolute** paths (`/overlay.css`) so
    `index.html` works under `/overlay/<id>`.
  - `index.html` — the OBS overlay; `<body class="pin-bottom">`; loads `/layout.js`
    **before** `/overlay.js`.
  - `editor.html` / `editor.js` / `editor.css` — the config UI at `/editor.html`.
    Manages profiles (create/rename/delete, shows & copies each profile's overlay URL),
    live keyboard preview on a grid **canvas** (`#preview.edit-canvas`, reuses overlay.css
    keycap styles), click-to-edit, and **free drag-to-position** (pointer events, no
    library) — drag snaps to 0.25-unit grid, hold **Alt** while dragging for fine
    placement. The inspector edits label / keycode / `w` / `h` / `x` / `y`; the "＋ เพิ่มปุ่ม"
    button appends a key on a new bottom row. "Record" binds a physical key via the same
    WebSocket. Saves via `PUT /api/profiles/:id`. `sel` is a flat **index** into the
    layout array. Remembers the last-used profile in `localStorage['flokz.profile']`.

- **`config/profiles.json`** — all saved profiles (git-ignored; the whole `config/` dir
  is ignored). Auto-created. A profile with an empty `layout` falls back to `layout.js`.

## Production model

Distributed as a **local app** each user runs on their own machine (keystrokes never
leave the device). "Generate URL" = per-profile local overlay URLs
(`http://localhost:PORT/overlay/<id>`). A hosted/cloud model is *not* used because the
global key hook must run locally. If packaging as a desktop app later, wrap this server
(e.g. Electron/pkg) — the architecture doesn't change.

## Conventions

- **Keycodes are uiohook codes, not browser `KeyboardEvent.code`.** The frontend
  hardcodes the numeric values in `layout.js`'s `KEY` table because the browser
  has no access to the `uiohook-napi` module. If you add keys, use uiohook values.
- Comments and user-facing docs are in Thai; keep that style when editing.
- No framework, no bundler — keep the frontend plain and directly loadable by OBS.
- Keep the background transparent (`background: transparent`) — never add an opaque
  page background or OBS compositing breaks.

## Run / test

```bash
npm install
npm start          # → http://localhost:3100
```

Open `http://localhost:3100` in a normal browser to verify rendering. To see key
animations you must grant **Accessibility** permission on macOS
(System Settings → Privacy & Security → Accessibility) to the terminal running node,
otherwise the hook receives no events.

## Gotchas

- Node 18 is used here; `uiohook-napi` ships prebuilt binaries. If the native
  binary ever fails to load, the fallback is `node-global-key-listener` (keep the
  same broadcast message shape).
- The service must stay running the whole stream; closing it stops updates (the
  overlay shows a "waiting for server" hint and auto-reconnects).
