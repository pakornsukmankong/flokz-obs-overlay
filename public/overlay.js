'use strict';

/**
 * overlay.js — ฝั่งหน้าเว็บที่ OBS โหลด
 *   1) หา profile id จาก URL (/overlay/<id>) — ถ้าไม่มีใช้ profile แรก
 *   2) โหลด layout ของ profile นั้น — ถ้าว่าง fallback ไป default ใน layout.js
 *   3) สร้างปุ่มคีย์บอร์ดตาม layout
 *   4) เชื่อม WebSocket: บอก profile ของตัวเอง (hello), รับ event กด/ปล่อยปุ่ม + คำสั่ง reload
 *   5) เพิ่ม/ลบ class .pressed เพื่อเล่นอนิเมชั่นกด
 */

(async function () {
  const board = document.getElementById('keyboard');

  // map: keycode -> [element, ...]  (เผื่อ layout มี keycode ซ้ำหลายที่)
  const keyMap = new Map();

  // profile id จาก path /overlay/<id> (ถ้าไม่มี = null)
  const pathMatch = location.pathname.match(/^\/overlay\/([A-Za-z0-9_-]+)/);
  let profileId = pathMatch ? pathMatch[1] : null;

  // ---- โหลด layout ของ profile ที่ระบุ (หรือ profile แรก) ------------------
  async function loadLayout() {
    try {
      // ไม่ระบุ id -> ใช้ profile แรกในเครื่อง
      if (!profileId) {
        const list = await (await fetch('/api/profiles', { cache: 'no-store' })).json();
        if (list && list.profiles && list.profiles.length) profileId = list.profiles[0].id;
      }
      if (profileId) {
        const res = await fetch('/api/profiles/' + profileId, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.layout) && json.layout.length) return json.layout;
        }
      }
    } catch (_) { /* server ไม่ตอบ — ใช้ default */ }
    return window.OVERLAY_LAYOUT || [];
  }

  // ---- สร้างปุ่มจาก layout (โมเดลพิกัดอิสระ: ทุกปุ่มมี x/y/w/h) ------------
  function build(layoutRaw) {
    const keys = (window.OVERLAY_TO_FREE ? window.OVERLAY_TO_FREE(layoutRaw) : layoutRaw) || [];

    let cols = 0, rows = 0; // ขนาดกล่อง = ขอบขวา/ล่างสุดของปุ่ม (หน่วยกริด)

    for (const key of keys) {
      const w = key.w != null ? key.w : 1;
      const h = key.h != null ? key.h : 1;

      const keyEl = document.createElement('div');
      keyEl.className = 'key';
      keyEl.style.setProperty('--x', String(key.x || 0));
      keyEl.style.setProperty('--y', String(key.y || 0));
      keyEl.style.setProperty('--w', String(w));
      keyEl.style.setProperty('--h', String(h));

      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.textContent = key.label != null ? key.label : '';
      keyEl.appendChild(cap);

      board.appendChild(keyEl);

      cols = Math.max(cols, (key.x || 0) + w);
      rows = Math.max(rows, (key.y || 0) + h);

      if (key.code != null) {
        if (!keyMap.has(key.code)) keyMap.set(key.code, []);
        keyMap.get(key.code).push(keyEl);
      }
    }

    // ขนาดกล่องพอดีกับปุ่ม เพื่อให้ pin-bottom จัดกึ่งกลางได้ถูกต้อง
    board.style.setProperty('--cols', String(cols));
    board.style.setProperty('--rows', String(rows));
  }

  // ---- อนิเมชั่นกด -------------------------------------------------------
  function setPressed(keycode, isDown) {
    const els = keyMap.get(keycode);
    if (!els) return; // ปุ่มนี้ไม่ได้อยู่ใน layout — ข้าม
    for (const el of els) el.classList.toggle('pressed', isDown);
  }

  // ---- WebSocket + auto-reconnect ---------------------------------------
  function connect() {
    const ws = new WebSocket(`ws://${location.host}`);

    ws.addEventListener('open', () => {
      document.body.classList.remove('disconnected');
      // บอก server ว่า overlay นี้เป็น profile ไหน (ใช้เลือกตอนสั่ง reload)
      ws.send(JSON.stringify({ type: 'hello', profile: profileId }));
    });

    ws.addEventListener('message', (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      if (data.type === 'down') setPressed(data.keycode, true);
      else if (data.type === 'up') setPressed(data.keycode, false);
      else if (data.type === 'reload') location.reload(); // editor สั่ง apply
    });

    ws.addEventListener('close', () => {
      document.body.classList.add('disconnected');
      // ล้างสถานะกดค้าง แล้วลองเชื่อมใหม่
      for (const els of keyMap.values()) {
        for (const el of els) el.classList.remove('pressed');
      }
      setTimeout(connect, 1000);
    });

    ws.addEventListener('error', () => ws.close());
  }

  build(await loadLayout());
  connect();
})();
