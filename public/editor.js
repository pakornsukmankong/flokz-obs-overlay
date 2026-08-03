'use strict';

/**
 * editor.js — หน้าคอนฟิก overlay (โมเดลวางปุ่มอิสระ: ทุกปุ่มมีพิกัด x/y)
 *   - พรีวิวคีย์บอร์ดสด คลิกปุ่มเพื่อแก้ไข
 *   - แก้ label / กว้าง(w) / สูง(h) / ตำแหน่ง(x,y) / bind keycode (dropdown หรือ Record)
 *   - ลากปุ่มเพื่อจัดตำแหน่งอิสระ (snap 0.25 หน่วย, กด Alt ค้าง = วางละเอียด)
 *   - บันทึกไป /api/profiles/:id แล้ว overlay ใน OBS รีโหลดเอง
 */

(function () {
  const KEY = window.OVERLAY_KEYS || {};
  const DEFAULT = window.OVERLAY_LAYOUT || []; // flat array พิกัด x/y
  const toFree = window.OVERLAY_TO_FREE || ((x) => x);

  const SNAP = 0.25;      // กริดจับตำแหน่งตอนลาก (หน่วย)
  const FINE = 0.02;      // ตอนกด Alt ค้าง = วางละเอียดเกือบอิสระ
  const SLACK = 2;        // เผื่อพื้นที่ผืนพรีวิวให้ลากออกไปได้ (หน่วย)

  // reverse map: code -> ชื่อปุ่ม (ตัวแรกที่เจอ)
  const codeToName = {};
  for (const name of Object.keys(KEY)) {
    if (codeToName[KEY[name]] === undefined) codeToName[KEY[name]] = name;
  }

  // ป้ายแนะนำสำหรับปุ่มพิเศษ (ที่เหลือใช้ชื่อ KEY ตรงๆ)
  const NICE = {
    SPACE: 'Space', SHIFT: 'Shift', SHIFT_R: 'Shift', CTRL: 'Ctrl', CTRL_R: 'Ctrl',
    ALT: 'Alt', ALT_R: 'Alt', META: 'Cmd', META_R: 'Cmd', ESC: 'Esc', TAB: 'Tab',
    ENTER: 'Enter', BACKSPACE: 'Bksp', CAPS: 'Caps',
    UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
    BACKQUOTE: '`', MINUS: '-', EQUAL: '=', BRACKET_L: '[', BRACKET_R: ']',
    BACKSLASH: '\\', SEMICOLON: ';', QUOTE: "'", COMMA: ',', PERIOD: '.', SLASH: '/',
  };

  function suggestLabel(code) {
    const n = codeToName[code];
    if (!n) return String(code);
    if (NICE[n]) return NICE[n];
    if (/^N[0-9]$/.test(n)) return n.slice(1);          // N1 -> 1
    if (n.length === 1) return n;                        // A -> A
    return n.charAt(0) + n.slice(1).toLowerCase();       // ENTER-ish -> Enter
  }

  // ตัวเลือกใน dropdown (เรียงตามชื่อ)
  const KEY_OPTIONS = Object.keys(KEY)
    .sort()
    .map((name) => ({ name, code: KEY[name] }));

  // ---- state ----
  let layout = null;      // flat array ของปุ่ม { code, label, x, y, w, h }
  let sel = null;         // index ของปุ่มที่เลือก (null = ไม่เลือก)
  let dirty = false;
  let profiles = [];      // [{id,name}]
  let currentId = null;   // profile ที่กำลังแก้
  let nodes = [];         // element ของแต่ละปุ่ม (index ตรงกับ layout)
  let posInputs = null;   // { x, y } input ใน inspector (อัปเดตสดตอนลาก)

  const $preview = document.getElementById('preview');
  const $inspector = document.getElementById('inspector');
  const $toast = document.getElementById('toast');
  const $select = document.getElementById('profile-select');
  const $url = document.getElementById('overlay-url');

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function overlayUrl() { return currentId ? `${location.origin}/overlay/${currentId}` : '—'; }
  function round3(v) { return Math.round(v * 1000) / 1000; }
  function snapTo(v, step) { return round3(Math.round(v / step) * step); }

  // ขนาดช่องกริดเป็น px (อ่านจาก CSS variables) = key-size + key-gap
  function cellPx() {
    const cs = getComputedStyle(document.documentElement);
    const size = parseFloat(cs.getPropertyValue('--key-size')) || 58;
    const gap = parseFloat(cs.getPropertyValue('--key-gap')) || 8;
    return size + gap;
  }

  function markDirty() {
    dirty = true;
    document.getElementById('btn-save').textContent = 'บันทึก & ใช้งาน •';
  }
  function clearDirty() {
    dirty = false;
    document.getElementById('btn-save').textContent = 'บันทึก & ใช้งาน';
  }

  // ---- profiles ----
  async function initProfiles() {
    try {
      const json = await (await fetch('/api/profiles', { cache: 'no-store' })).json();
      profiles = (json && json.profiles) || [];
    } catch (_) { profiles = []; }

    // เลือก profile ล่าสุดที่ใช้ (จำใน localStorage) ถ้ายังมีอยู่
    const last = localStorage.getItem('flokz.profile');
    currentId = profiles.some((p) => p.id === last) ? last
      : (profiles[0] ? profiles[0].id : null);

    renderProfileSelect();
    if (currentId) await loadProfile(currentId);
    else render();
  }

  function renderProfileSelect() {
    $select.innerHTML = '';
    for (const p of profiles) {
      const o = el('option'); o.value = p.id; o.textContent = p.name;
      if (p.id === currentId) o.selected = true;
      $select.appendChild(o);
    }
    $url.textContent = overlayUrl();
  }

  async function loadProfile(id) {
    try {
      const res = await fetch('/api/profiles/' + id, { cache: 'no-store' });
      const json = await res.json();
      layout = Array.isArray(json.layout) && json.layout.length ? toFree(json.layout) : clone(DEFAULT);
    } catch (_) {
      layout = clone(DEFAULT);
    }
    currentId = id;
    localStorage.setItem('flokz.profile', id);
    sel = null; clearDirty();
    renderProfileSelect();
    render();
  }

  async function switchProfile(id) {
    if (id === currentId) return;
    if (dirty && !confirm('มีการแก้ที่ยังไม่บันทึก จะทิ้งแล้วสลับ profile ไหม?')) {
      renderProfileSelect(); // คืน select กลับตัวเดิม
      return;
    }
    await loadProfile(id);
  }

  async function newProfile() {
    const name = (prompt('ตั้งชื่อ profile ใหม่', 'Profile ' + (profiles.length + 1)) || '').trim();
    if (!name) return;
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, layout: clone(DEFAULT) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'สร้างไม่สำเร็จ');
      profiles.push(json.profile);
      await loadProfile(json.profile.id);
      toast('สร้าง profile "' + name + '" แล้ว', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }

  async function renameProfile() {
    if (!currentId) return;
    const cur = profiles.find((p) => p.id === currentId);
    const name = (prompt('เปลี่ยนชื่อ profile', cur ? cur.name : '') || '').trim();
    if (!name) return;
    try {
      const res = await fetch('/api/profiles/' + currentId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'เปลี่ยนชื่อไม่สำเร็จ');
      if (cur) cur.name = name;
      renderProfileSelect();
      toast('เปลี่ยนชื่อแล้ว', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }

  async function deleteProfile() {
    if (!currentId) return;
    if (profiles.length <= 1) { toast('ต้องมีอย่างน้อย 1 profile', 'err'); return; }
    const cur = profiles.find((p) => p.id === currentId);
    if (!confirm('ลบ profile "' + (cur ? cur.name : '') + '" ? (URL นี้จะใช้ไม่ได้อีก)')) return;
    try {
      const res = await fetch('/api/profiles/' + currentId, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      profiles = profiles.filter((p) => p.id !== currentId);
      await loadProfile(profiles[0].id);
      toast('ลบ profile แล้ว', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }

  async function copyUrl() {
    if (!currentId) return;
    try {
      await navigator.clipboard.writeText(overlayUrl());
      toast('คัดลอก URL แล้ว', 'ok');
    } catch (_) {
      toast('คัดลอกไม่ได้ — ก็อปเองจากช่อง URL', 'err');
    }
  }

  // ---- render พรีวิว (ผืนกริดวางปุ่มอิสระ) ----
  function render() {
    $preview.innerHTML = '';
    nodes = [];

    layout.forEach((item, i) => {
      const node = el('div', 'key');
      node.dataset.i = String(i);
      node.style.setProperty('--x', String(item.x || 0));
      node.style.setProperty('--y', String(item.y || 0));
      node.style.setProperty('--w', String(item.w || 1));
      node.style.setProperty('--h', String(item.h || 1));
      const cap = el('span', 'cap');
      cap.textContent = item.label != null ? item.label : '';
      node.appendChild(cap);
      if (sel === i) node.classList.add('selected');
      makeDraggable(node, i);
      $preview.appendChild(node);
      nodes[i] = node;
    });

    resizeCanvas();
    renderInspector();
  }

  // ปรับขนาดผืนพรีวิวให้ครอบปุ่มไกลสุด + เผื่อพื้นที่ลาก (SLACK)
  function resizeCanvas() {
    let cols = 0, rows = 0;
    for (const item of layout) {
      cols = Math.max(cols, (item.x || 0) + (item.w || 1));
      rows = Math.max(rows, (item.y || 0) + (item.h || 1));
    }
    $preview.style.setProperty('--cols', String(Math.max(cols, 1) + SLACK));
    $preview.style.setProperty('--rows', String(Math.max(rows, 1) + SLACK));
  }

  // ---- ลากปุ่มเพื่อจัดตำแหน่ง (pointer events, ไม่ใช้ HTML5 DnD) ----
  function makeDraggable(node, index) {
    node.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      select(index);

      const item = layout[index];
      const cell = cellPx();
      const startX = e.clientX, startY = e.clientY;
      const origX = item.x || 0, origY = item.y || 0;
      let moved = false;

      node.setPointerCapture(e.pointerId);
      node.classList.add('dragging');

      const onMove = (ev) => {
        if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) moved = true;
        const step = ev.altKey ? FINE : SNAP;
        const nx = Math.max(0, snapTo(origX + (ev.clientX - startX) / cell, step));
        const ny = Math.max(0, snapTo(origY + (ev.clientY - startY) / cell, step));
        item.x = nx; item.y = ny;
        node.style.setProperty('--x', String(nx));
        node.style.setProperty('--y', String(ny));
        if (posInputs) { posInputs.x.value = nx; posInputs.y.value = ny; }
      };
      const onUp = () => {
        node.releasePointerCapture(e.pointerId);
        node.classList.remove('dragging');
        node.removeEventListener('pointermove', onMove);
        node.removeEventListener('pointerup', onUp);
        if (moved) { markDirty(); resizeCanvas(); }
      };
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerup', onUp);
    });
  }

  // เลือกปุ่ม — อัปเดตแค่ selection + inspector (ไม่ rerender ทั้งผืน คงตัวที่กำลังลาก)
  function select(i) {
    sel = i; recording = false;
    for (const n of nodes) if (n) n.classList.remove('selected');
    if (nodes[i]) nodes[i].classList.add('selected');
    renderInspector();
  }

  function renderInspector() {
    $inspector.innerHTML = '';
    posInputs = null;
    const h = el('h2'); h.textContent = 'แก้ไข'; $inspector.appendChild(h);

    if (sel == null || !layout[sel]) {
      const p = el('p', 'empty-hint');
      p.textContent = 'คลิกปุ่มในพรีวิวเพื่อแก้ไข • ลากปุ่มเพื่อจัดตำแหน่งอิสระ (กด Alt ค้างขณะลาก = วางละเอียด) • ปุ่ม “เพิ่มปุ่ม” ด้านล่างเพื่อเพิ่มปุ่มใหม่';
      $inspector.appendChild(p);
      return;
    }

    const item = layout[sel];

    // ป้าย (label)
    $inspector.appendChild(textField('ป้าย (label)', item.label || '', (v) => {
      item.label = v; patchSelected(); markDirty();
    }));

    // keycode: dropdown + record
    const codeField = el('div', 'field');
    const lbl = el('label'); lbl.textContent = 'ปุ่มจริง (keycode)'; codeField.appendChild(lbl);
    const krow = el('div', 'keyrow');
    const selectEl = el('select');
    for (const opt of KEY_OPTIONS) {
      const o = el('option'); o.value = String(opt.code);
      o.textContent = `${opt.name} (${opt.code})`;
      if (opt.code === item.code) o.selected = true;
      selectEl.appendChild(o);
    }
    // เผื่อ code ปัจจุบันไม่อยู่ในตาราง
    if (codeToName[item.code] === undefined && item.code != null) {
      const o = el('option'); o.value = String(item.code);
      o.textContent = `custom (${item.code})`; o.selected = true;
      selectEl.appendChild(o);
    }
    selectEl.addEventListener('change', () => {
      item.code = Number(selectEl.value);
      item.label = suggestLabel(item.code);
      patchSelected(); renderInspector(); markDirty();
    });
    const recBtn = el('button', 'small'); recBtn.id = 'btn-record'; recBtn.textContent = '🎯 Record';
    recBtn.title = 'กดแล้วกดปุ่มจริงบนคีย์บอร์ด';
    recBtn.addEventListener('click', toggleRecord);
    krow.appendChild(selectEl); krow.appendChild(recBtn);
    codeField.appendChild(krow);
    const info = el('div', 'codeinfo');
    info.textContent = recording ? 'กำลังรอ… กดปุ่มจริงบนคีย์บอร์ด (ต้องมีสิทธิ์ Accessibility)' :
      `code: ${item.code} ${codeToName[item.code] ? '(' + codeToName[item.code] + ')' : ''}`;
    codeField.appendChild(info);
    $inspector.appendChild(codeField);
    if (recording) recBtn.classList.add('recording');

    // ขนาด: กว้าง (w) + สูง (h)
    const sizeRow = el('div', 'grid2');
    sizeRow.appendChild(numberField('กว้าง (w)', item.w || 1, 0.3, (v) => {
      item.w = v; patchSelected(); resizeCanvas(); markDirty();
    }));
    sizeRow.appendChild(numberField('สูง (h)', item.h || 1, 0.3, (v) => {
      item.h = v; patchSelected(); resizeCanvas(); markDirty();
    }));
    $inspector.appendChild(sizeRow);

    // ตำแหน่ง: X + Y (หน่วยกริด)
    const posRow = el('div', 'grid2');
    const xf = numberField('ตำแหน่ง X', round3(item.x || 0), 0, (v) => {
      item.x = round3(v); patchSelected(); resizeCanvas(); markDirty();
    });
    const yf = numberField('ตำแหน่ง Y', round3(item.y || 0), 0, (v) => {
      item.y = round3(v); patchSelected(); resizeCanvas(); markDirty();
    });
    posRow.appendChild(xf); posRow.appendChild(yf);
    $inspector.appendChild(posRow);
    posInputs = { x: xf.querySelector('input'), y: yf.querySelector('input') };

    const hint = el('div', 'codeinfo');
    hint.textContent = 'ℹ︎ ลากปุ่มในพรีวิวเพื่อจัดตำแหน่งอิสระ • Alt ค้าง = วางละเอียด';
    $inspector.appendChild(hint);

    $inspector.appendChild(deleteBtn('ลบปุ่มนี้'));
  }

  // ---- helper fields ----
  function textField(label, value, onInput) {
    const f = el('div', 'field');
    const l = el('label'); l.textContent = label; f.appendChild(l);
    const inp = el('input'); inp.type = 'text'; inp.value = value;
    inp.addEventListener('input', () => onInput(inp.value));
    f.appendChild(inp);
    return f;
  }
  function numberField(label, value, min, onInput) {
    const f = el('div', 'field');
    const l = el('label'); l.textContent = label; f.appendChild(l);
    const inp = el('input'); inp.type = 'number'; inp.step = '0.25'; inp.min = String(min); inp.value = value;
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (!isNaN(v) && v >= min) onInput(v);
    });
    f.appendChild(inp);
    return f;
  }
  function deleteBtn(label) {
    const b = el('button', 'danger'); b.textContent = label;
    b.addEventListener('click', removeSelected);
    return b;
  }

  // อัปเดตเฉพาะปุ่มที่เลือกในพรีวิว (ไม่ rerender ทั้งหมด — คงโฟกัส input ไว้)
  function patchSelected() {
    const node = nodes[sel];
    if (!node) return;
    const item = layout[sel];
    node.style.setProperty('--x', String(item.x || 0));
    node.style.setProperty('--y', String(item.y || 0));
    node.style.setProperty('--w', String(item.w || 1));
    node.style.setProperty('--h', String(item.h || 1));
    const cap = node.querySelector('.cap');
    if (cap) cap.textContent = item.label != null ? item.label : '';
  }

  // ---- actions ----
  function addKey() {
    // วางปุ่มใหม่ที่แถวใหม่ด้านล่าง (มุมซ้าย) จะได้หยิบง่าย ไม่ทับของเดิม
    let rows = 0;
    for (const item of layout) rows = Math.max(rows, (item.y || 0) + (item.h || 1));
    const code = KEY.A != null ? KEY.A : 30;
    layout.push({ code, label: suggestLabel(code), x: 0, y: rows, w: 1, h: 1 });
    sel = layout.length - 1;
    markDirty(); render();
  }
  function removeSelected() {
    if (sel == null) return;
    layout.splice(sel, 1);
    sel = null; markDirty(); render();
  }

  // ---- record keycode ผ่าน WebSocket (ใช้ hook ที่มีอยู่) ----
  let recording = false;
  function toggleRecord() {
    if (sel == null) return;
    recording = !recording;
    renderInspector();
  }

  function connectWs() {
    const ws = new WebSocket(`ws://${location.host}`);
    ws.addEventListener('message', (ev) => {
      let data; try { data = JSON.parse(ev.data); } catch (_) { return; }
      if (recording && data.type === 'down' && sel != null) {
        const item = layout[sel];
        if (item) {
          item.code = data.keycode;
          item.label = suggestLabel(data.keycode);
          recording = false;
          markDirty(); patchSelected(); renderInspector();
          toast('จับปุ่มได้: ' + item.label, 'ok');
        }
      }
      // ไม่สนใจ reload ในหน้า editor
    });
    ws.addEventListener('close', () => setTimeout(connectWs, 1500));
    ws.addEventListener('error', () => ws.close());
  }

  // ---- save (ของ profile ปัจจุบัน) ----
  async function save() {
    if (!currentId) return;
    try {
      const res = await fetch('/api/profiles/' + currentId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'save failed');
      clearDirty();
      toast('บันทึกแล้ว — overlay ของ profile นี้จะรีโหลดเอง', 'ok');
    } catch (err) {
      toast('บันทึกไม่สำเร็จ: ' + err.message, 'err');
    }
  }

  function resetDefault() {
    layout = clone(DEFAULT);
    sel = null; markDirty(); render();
    toast('คืนค่า layout เริ่มต้นแล้ว (ยังไม่บันทึก)');
  }

  let toastTimer = null;
  function toast(msg, kind) {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.className = 'toast'; }, 2600);
  }

  // ---- wire up ----
  document.getElementById('btn-save').addEventListener('click', save);
  document.getElementById('btn-reset').addEventListener('click', resetDefault);
  document.getElementById('btn-add-key').addEventListener('click', addKey);
  document.getElementById('btn-open').addEventListener('click', () => {
    if (currentId) window.open(overlayUrl(), '_blank');
  });
  document.getElementById('btn-new').addEventListener('click', newProfile);
  document.getElementById('btn-rename').addEventListener('click', renameProfile);
  document.getElementById('btn-delete').addEventListener('click', deleteProfile);
  document.getElementById('btn-copy').addEventListener('click', copyUrl);
  $select.addEventListener('change', () => switchProfile($select.value));
  // คลิกพื้นที่ว่างของผืนพรีวิว = ยกเลิกการเลือก
  $preview.addEventListener('pointerdown', (e) => {
    if (e.target !== $preview || sel == null) return;
    sel = null; recording = false;
    for (const n of nodes) if (n) n.classList.remove('selected');
    renderInspector();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && recording) toggleRecord(); });

  initProfiles();
  connectWs();
})();
