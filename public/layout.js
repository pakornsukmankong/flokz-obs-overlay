/* =============================================================================
 * layout.js — ⭐ CONFIG หลัก: ปรับ layout ปุ่มที่จะแสดงบน overlay ได้ที่นี่
 * =============================================================================
 *
 * โมเดล layout ปัจจุบันเป็นแบบ "วางอิสระ" (free positioning): ทุกปุ่มมีพิกัด x/y
 * ของตัวเอง วางตรงไหนก็ได้ ลบปุ่มหนึ่งไม่ทำให้ปุ่มอื่นเลื่อน
 *
 * แต่ละปุ่มมี property:
 *   code  : keycode ของ uiohook (ดูตาราง KEY ด้านล่าง) — ตัวที่ผูกกับปุ่มจริง
 *   label : ข้อความที่โชว์บนปุ่ม
 *   x, y  : ตำแหน่งเป็น "หน่วยกริด" (1 หน่วย = 1 ช่องปุ่มปกติรวมช่องว่าง) — มุมซ้ายบน = 0,0
 *   w     : ความกว้างเป็นหน่วย (1 = ปุ่มปกติ, 2 = กว้าง 2 เท่า ฯลฯ) — ไม่ใส่ = 1
 *   h     : ความสูงเป็นหน่วย — ไม่ใส่ = 1
 *
 * ค่า default ด้านล่างยังเขียนแบบ "แถว" (อ่านง่าย) แล้วให้ toFreeLayout() แปลง
 * เป็นพิกัด x/y ให้อัตโนมัติตอนโหลด
 * ========================================================================== */

// ตาราง keycode ของ uiohook — ใช้ค่าพวกนี้ในช่อง code
const KEY = {
  // ตัวอักษร
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23,
  J: 36, K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19,
  S: 31, T: 20, U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44,
  // ตัวเลขแถวบน
  N0: 11, N1: 2, N2: 3, N3: 4, N4: 5, N5: 6, N6: 7, N7: 8, N8: 9, N9: 10,
  // ปุ่มพิเศษ
  ESC: 1, TAB: 15, CAPS: 58, ENTER: 28, BACKSPACE: 14, SPACE: 57,
  SHIFT: 42, SHIFT_R: 54, CTRL: 29, CTRL_R: 3613,
  ALT: 56, ALT_R: 3640, META: 3675, META_R: 3676,
  // ลูกศร
  UP: 57416, DOWN: 57424, LEFT: 57419, RIGHT: 57421,
  // ฟังก์ชัน
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  // เครื่องหมาย
  MINUS: 12, EQUAL: 13, BRACKET_L: 26, BRACKET_R: 27, BACKSLASH: 43,
  SEMICOLON: 39, QUOTE: 40, COMMA: 51, PERIOD: 52, SLASH: 53, BACKQUOTE: 41,
};

// -----------------------------------------------------------------------------
// LAYOUT เริ่มต้น — แนว gaming (WASD) + ปุ่มที่ใช้บ่อย  แก้ได้ตามใจ
// -----------------------------------------------------------------------------
const LAYOUT = [
  // แถวตัวเลข 1-0 (อยู่เหนือ QWERTYUIOP)
  [
    { code: KEY.N1, label: '1' },
    { code: KEY.N2, label: '2' },
    { code: KEY.N3, label: '3' },
    { code: KEY.N4, label: '4' },
    { code: KEY.N5, label: '5' },
    { code: KEY.N6, label: '6' },
    { code: KEY.N7, label: '7' },
    { code: KEY.N8, label: '8' },
    { code: KEY.N9, label: '9' },
    { code: KEY.N0, label: '0' },
  ],
  // แถว QWERTYUIOP
  [
    { code: KEY.Q, label: 'Q' },
    { code: KEY.W, label: 'W' },
    { code: KEY.E, label: 'E' },
    { code: KEY.R, label: 'R' },
    { code: KEY.T, label: 'T' },
    { code: KEY.Y, label: 'Y' },
    { code: KEY.U, label: 'U' },
    { code: KEY.I, label: 'I' },
    { code: KEY.O, label: 'O' },
    { code: KEY.P, label: 'P' },
  ],
  // แถว ASDFGHJKL (เยื้องขวาเล็กน้อยแบบคีย์บอร์ดจริง)
  [
    { spacer: 0.5 },
    { code: KEY.A, label: 'A' },
    { code: KEY.S, label: 'S' },
    { code: KEY.D, label: 'D' },
    { code: KEY.F, label: 'F' },
    { code: KEY.G, label: 'G' },
    { code: KEY.H, label: 'H' },
    { code: KEY.J, label: 'J' },
    { code: KEY.K, label: 'K' },
    { code: KEY.L, label: 'L' },
  ],
  // แถว ZXCVBNM + Shift ขวา + ลูกศรขึ้น (แบบคีย์บอร์ด 65%)
  [
    { spacer: 1.1 },
    { code: KEY.Z, label: 'Z' },
    { code: KEY.X, label: 'X' },
    { code: KEY.C, label: 'C' },
    { code: KEY.V, label: 'V' },
    { code: KEY.B, label: 'B' },
    { code: KEY.N, label: 'N' },
    { code: KEY.M, label: 'M' },
    { code: KEY.SHIFT_R, label: 'Shift', width: 1.6 },
    { code: KEY.UP, label: '↑' },
  ],
  // แถวล่าง: modifiers + Space + ← ↓ → (↓ อยู่ตรงกับ ↑ พอดี)
  [
    { code: KEY.CTRL, label: 'Ctrl', width: 1.4 },
    { code: KEY.ALT, label: 'Alt', width: 1.2 },
    { code: KEY.SPACE, label: 'Space', width: 6.1 },
    { code: KEY.LEFT, label: '←' },
    { code: KEY.DOWN, label: '↓' },
    { code: KEY.RIGHT, label: '→' },
  ],
];

// -----------------------------------------------------------------------------
// toFreeLayout — normalize layout ให้เป็น "รายการปุ่มพร้อมพิกัด x/y" (flat array)
//   - ถ้าเป็นรูปแบบใหม่อยู่แล้ว (flat array ของ object ที่มี x) → คืนตามเดิม
//   - ถ้าเป็นรูปแบบเก่า (array ของแถว [[...],[...]]) → แปลงเป็นพิกัด x/y
//       แต่ละแถว = 1 หน่วยในแกน y, spacer จะดันตำแหน่ง x ต่อไป (ไม่สร้างปุ่ม)
//   idempotent: เรียกซ้ำได้ผลเท่าเดิม (overlay.js / editor.js ใช้ normalize ค่าที่โหลดมา)
// -----------------------------------------------------------------------------
function toFreeLayout(layout) {
  if (!Array.isArray(layout) || layout.length === 0) return [];
  // รูปแบบใหม่: flat array ของปุ่ม (ไม่ใช่ array ซ้อน)
  if (!Array.isArray(layout[0])) {
    return layout
      .filter((k) => k && k.spacer == null) // กัน spacer เก่าที่หลุดมาในรูป flat
      .map((k) => ({
        code: k.code,
        label: k.label,
        x: +k.x || 0,
        y: +k.y || 0,
        w: k.w != null ? +k.w : (k.width != null ? +k.width : 1),
        h: k.h != null ? +k.h : 1,
      }));
  }
  // รูปแบบเก่า: array ของแถว → กระจายเป็นพิกัด
  const keys = [];
  layout.forEach((row, y) => {
    let x = 0;
    for (const item of row) {
      if (!item) continue;
      if (item.spacer != null) { x += +item.spacer || 0; continue; }
      const w = item.width != null ? +item.width : 1;
      keys.push({ code: item.code, label: item.label, x, y, w, h: 1 });
      x += w;
    }
  });
  return keys;
}

// อย่าแก้บรรทัดล่างนี้ (ส่งค่าออกให้ overlay.js / editor.js ใช้)
window.OVERLAY_LAYOUT = toFreeLayout(LAYOUT); // default ในรูปพิกัด x/y
window.OVERLAY_TO_FREE = toFreeLayout;        // ใช้ normalize layout ของ profile ที่โหลดมา
window.OVERLAY_KEYS = KEY; // ตาราง name -> keycode (editor ใช้ทำ dropdown/reverse-map)
