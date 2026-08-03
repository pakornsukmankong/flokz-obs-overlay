'use strict';

/**
 * FLOKZ OBS Keyboard Overlay — main service
 *
 * หน้าที่:
 *   1) เสิร์ฟไฟล์ใน ../public ผ่าน HTTP ให้ OBS โหลด (http://localhost:PORT)
 *   2) เปิด WebSocket ส่ง event กด/ปล่อยปุ่มไปยัง overlay
 *   3) spawn child process (hook.js) ที่ทำ global keyboard hook และรับ event มา broadcast
 *
 * เหตุที่ต้องมี service นี้: OBS Browser Source รับ keyboard event ระดับ global ไม่ได้
 * เวลาโฟกัสอยู่ที่เกม/แอปอื่น ต้อง hook จาก OS แล้วส่งเข้า overlay เอง
 * (การ hook แยกไว้ใน child process — ดู hook.js)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fork } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3100;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const PROFILES_FILE = path.join(CONFIG_DIR, 'profiles.json');
const LEGACY_LAYOUT_FILE = path.join(CONFIG_DIR, 'layout.json'); // ของเวอร์ชันก่อน (profile เดียว)

// ---- Profiles store (persisted) -------------------------------------------
//
// เก็บหลาย profile ต่อเครื่อง แต่ละอันมี overlay URL ของตัวเอง (/overlay/<id>)
// รูปแบบไฟล์: { version, profiles: [ { id, name, layout } ] }
// layout ว่าง ([]) = ให้ overlay ใช้ค่า default ใน public/layout.js

function genId() {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

function writeStore(store) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) return parsed;
  } catch (_) { /* ไม่มีไฟล์ / เสีย — seed ใหม่ */ }

  // seed: ถ้ามีไฟล์เวอร์ชันเก่า (layout.json) ให้ย้ายมาเป็น profile "Default"
  let seedLayout = [];
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_LAYOUT_FILE, 'utf8'));
    if (Array.isArray(legacy)) seedLayout = legacy;
  } catch (_) {}

  const store = { version: 1, profiles: [{ id: genId(), name: 'Default', layout: seedLayout }] };
  writeStore(store); // persist ทันที เพื่อให้ id (และ URL) คงที่
  return store;
}

function findProfile(store, id) {
  return store.profiles.find((p) => p.id === id) || null;
}

// ---- Static file server ---------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serveFile(res, rel) {
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// อ่าน request body (JSON) พร้อมจำกัดขนาด
function readJsonBody(req, res, cb) {
  let body = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 512 * 1024) { tooBig = true; req.destroy(); }
  });
  req.on('end', () => {
    if (tooBig) return;
    try { cb(JSON.parse(body || '{}')); }
    catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
    }
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const method = req.method;

  // ---- API: รายชื่อ profile ----
  if (urlPath === '/api/profiles' && method === 'GET') {
    const store = readStore();
    sendJson(res, 200, { profiles: store.profiles.map((p) => ({ id: p.id, name: p.name })) });
    return;
  }

  // ---- API: สร้าง profile ใหม่ ----
  if (urlPath === '/api/profiles' && method === 'POST') {
    readJsonBody(req, res, (body) => {
      const store = readStore();
      const name = (body.name || 'Untitled').toString().slice(0, 60).trim() || 'Untitled';
      const profile = { id: genId(), name, layout: Array.isArray(body.layout) ? body.layout : [] };
      store.profiles.push(profile);
      writeStore(store);
      sendJson(res, 200, { ok: true, profile: { id: profile.id, name: profile.name } });
    });
    return;
  }

  // ---- API ที่อ้างถึง profile ตาม id: /api/profiles/<id> ----
  const m = urlPath.match(/^\/api\/profiles\/([A-Za-z0-9_-]+)$/);
  if (m) {
    const id = m[1];

    if (method === 'GET') {
      const store = readStore();
      const p = findProfile(store, id);
      if (!p) return sendJson(res, 404, { ok: false, error: 'not found' });
      return sendJson(res, 200, { id: p.id, name: p.name, layout: p.layout });
    }

    if (method === 'PUT') {
      return readJsonBody(req, res, (body) => {
        const store = readStore();
        const p = findProfile(store, id);
        if (!p) return sendJson(res, 404, { ok: false, error: 'not found' });
        if (typeof body.name === 'string') p.name = body.name.slice(0, 60).trim() || p.name;
        if (Array.isArray(body.layout)) p.layout = body.layout;
        writeStore(store);
        reloadProfile(id); // สั่งเฉพาะ overlay ของ profile นี้ให้รีโหลด
        sendJson(res, 200, { ok: true });
      });
    }

    if (method === 'DELETE') {
      const store = readStore();
      if (store.profiles.length <= 1) {
        return sendJson(res, 400, { ok: false, error: 'ต้องมีอย่างน้อย 1 profile' });
      }
      const before = store.profiles.length;
      store.profiles = store.profiles.filter((p) => p.id !== id);
      if (store.profiles.length === before) return sendJson(res, 404, { ok: false, error: 'not found' });
      writeStore(store);
      return sendJson(res, 200, { ok: true });
    }
  }

  // ---- overlay ต่อ profile: /overlay/<id> -> เสิร์ฟหน้า overlay เดียวกัน ----
  if (/^\/overlay\/[A-Za-z0-9_-]+\/?$/.test(urlPath)) {
    serveFile(res, 'index.html');
    return;
  }

  // ---- ไฟล์ static ----
  serveFile(res, urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
});

// ---- WebSocket broadcast --------------------------------------------------

const wss = new WebSocketServer({ server });

// key event ส่งให้ทุก overlay (การกดปุ่มจริงต้องติดทุก profile ที่เปิดอยู่)
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) client.send(msg);
  }
}

// reload เฉพาะ overlay ของ profile ที่ถูกแก้ (จากปุ่ม Save ใน editor)
function reloadProfile(id) {
  const msg = JSON.stringify({ type: 'reload' });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client._profile === id) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  console.log('[ws] client connected (%d total)', wss.clients.size);
  // overlay จะบอกว่าตัวเองเป็น profile ไหน ผ่านข้อความ hello
  ws.on('message', (raw) => {
    let data; try { data = JSON.parse(raw); } catch (_) { return; }
    if (data && data.type === 'hello') ws._profile = data.profile || null;
  });
});

// ---- Global keyboard hook (child process) ---------------------------------

let hook = null;
let warnedAccessibility = false;
let stopping = false;

function startHook() {
  if (stopping) return;

  const startedAt = Date.now();
  hook = fork(path.join(__dirname, 'hook.js'), { silent: true });

  hook.on('message', (msg) => {
    if (msg && msg.type === 'ready') {
      warnedAccessibility = false;
      console.log('[hook] global keyboard hook started');
      return;
    }
    if (msg && (msg.type === 'down' || msg.type === 'up')) {
      broadcast({ type: msg.type, keycode: msg.keycode });
    }
  });

  hook.on('exit', (code) => {
    if (stopping) return;

    const aliveMs = Date.now() - startedAt;
    // ตายเร็ว (<2s) มักเพราะยังไม่ได้สิทธิ์ Accessibility (uiohook เรียก abort)
    if (aliveMs < 2000 && !warnedAccessibility) {
      warnedAccessibility = true;
      console.warn('');
      console.warn('[hook] ⚠️  ยังใช้งาน keyboard hook ไม่ได้ (code %s)', code);
      console.warn('[hook]    macOS: เปิดสิทธิ์ Accessibility ให้ Terminal/แอปที่รัน node');
      console.warn('[hook]    System Settings > Privacy & Security > Accessibility');
      console.warn('[hook]    ให้สิทธิ์แล้วระบบจะเชื่อมต่อให้อัตโนมัติ (overlay ยังเสิร์ฟปกติ)');
      console.warn('');
    }
    // ลองใหม่เรื่อยๆ — พอผู้ใช้ให้สิทธิ์แล้วจะ start สำเร็จเอง
    setTimeout(startHook, 3000);
  });
}

// ---- Boot -----------------------------------------------------------------

server.listen(PORT, () => {
  console.log('──────────────────────────────────────────────');
  console.log(' FLOKZ OBS Keyboard Overlay');
  console.log('──────────────────────────────────────────────');
  console.log(' Overlay URL : http://localhost:%d', PORT);
  console.log(' ใช้ URL นี้ใน OBS > Browser Source');
  console.log('');
  console.log(' macOS: ต้องอนุญาต Accessibility ให้ Terminal/แอปที่รัน node');
  console.log(' System Settings > Privacy & Security > Accessibility');
  console.log('──────────────────────────────────────────────');
  startHook();
});

function shutdown() {
  stopping = true;
  console.log('\nกำลังปิด...');
  if (hook) {
    try { hook.kill(); } catch (_) {}
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
