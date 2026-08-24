'use strict';
/**
 * server.js — custom Next server (1 process)
 *   - รัน Next.js (หน้าเว็บ + API routes)
 *   - แนบ WebSocket server บน HTTP เดียวกัน (broadcast key event / reload / grind relay)
 *   - spawn server/hook.js (uiohook global key hook) เป็น child process
 *
 * WS hub ถูกวางไว้บน globalThis เพื่อให้ Next Route Handler เข้าถึง instance เดียวกันได้
 */
const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const { fork } = require('child_process');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT ? Number(process.env.PORT) : 3100;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url, true)));

  // WS แบบ noServer เพื่อ "แชร์" พอร์ตกับ Next HMR: upgrade ของ /_next ให้ Next จัดการ
  // ที่เหลือเป็น WebSocket ของเรา (key events / reload / grind relay)
  // perMessageDeflate ปิดไว้: บาง proxy/สภาพแวดล้อมทำเฟรมที่ถูกบีบอัดเพี้ยน → ปิดกัน 1006
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const nextUpgrade = app.getUpgradeHandler();
  const onUpgrade = (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);
    if (pathname && pathname.startsWith('/_next')) {
      nextUpgrade(req, socket, head); // HMR ของ Next
    } else {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    }
  };
  server.on('upgrade', onUpgrade);

  // Next dev แอบเพิ่ม upgrade listener ของตัวเองแบบ lazy (ไป destroy socket ของเรา
  // และทำ HMR frame เพี้ยน) — กันไม่ให้ listener อื่นนอกจากของเราถูกเพิ่ม
  server.on('newListener', (event, listener) => {
    if (event === 'upgrade' && listener !== onUpgrade) {
      process.nextTick(() => server.removeListener('upgrade', listener));
    }
  });

  function broadcast(obj) {
    const m = JSON.stringify(obj);
    for (const c of wss.clients) if (c.readyState === 1) c.send(m);
  }
  function reloadProfile(id) {
    const m = JSON.stringify({ type: 'reload' });
    for (const c of wss.clients) if (c.readyState === 1 && c._profile === id) c.send(m);
  }
  function relayGrind(state) {
    const m = JSON.stringify(state);
    for (const c of wss.clients) if (c.readyState === 1 && c._grindToken === state.token) c.send(m);
  }
  function talkReload() { broadcast({ type: 'talk-reload' }); }

  // ให้ Route Handler เรียกใช้ผ่าน lib/ws-hub
  globalThis.__FLOKZ_HUB = { broadcast, reloadProfile, relayGrind, talkReload };

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let d; try { d = JSON.parse(raw); } catch (_) { return; }
      if (!d) return;
      if (d.type === 'hello') ws._profile = d.profile || null;
      else if (d.type === 'grind-hello') ws._grindToken = d.token || null;
      else if (d.type === 'grind-state' && d.token) relayGrind(d);
    });
  });

  // ---- uiohook child process ----
  let hook = null, warned = false, stopping = false;
  function startHook() {
    if (stopping) return;
    const startedAt = Date.now();
    hook = fork(path.join(__dirname, 'server', 'hook.js'), { silent: true });
    hook.on('message', (m) => {
      if (m && m.type === 'ready') { warned = false; console.log('[hook] global keyboard hook started'); return; }
      if (m && (m.type === 'down' || m.type === 'up')) broadcast({ type: m.type, keycode: m.keycode });
    });
    hook.on('exit', () => {
      if (stopping) return;
      if (Date.now() - startedAt < 2000 && !warned) {
        warned = true;
        console.warn('[hook] ⚠️  ยังใช้ keyboard hook ไม่ได้ — macOS ต้องเปิดสิทธิ์ Accessibility (overlay ยังเสิร์ฟปกติ)');
      }
      setTimeout(startHook, 3000);
    });
  }
  startHook();

  function shutdown() {
    stopping = true;
    try { if (hook) hook.kill(); } catch (_) {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(port, () => {
    console.log('──────────────────────────────────────────────');
    console.log(' FLOKZ Overlay Suite  ·  http://localhost:%d', port);
    console.log(' dev=%s', dev);
    console.log('──────────────────────────────────────────────');
  });
});
