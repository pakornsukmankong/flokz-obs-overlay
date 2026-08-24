/**
 * keyboard.ts — โมเดล layout คีย์บอร์ด (free positioning: ทุกปุ่มมีพิกัด x/y/w/h)
 * ตาราง KEY เป็น keycode ของ uiohook (ไม่ใช่ KeyboardEvent.code)
 */

export type KeyDef = {
  code?: number;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const KEY: Record<string, number> = {
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23,
  J: 36, K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19,
  S: 31, T: 20, U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44,
  N0: 11, N1: 2, N2: 3, N3: 4, N4: 5, N5: 6, N6: 7, N7: 8, N8: 9, N9: 10,
  ESC: 1, TAB: 15, CAPS: 58, ENTER: 28, BACKSPACE: 14, SPACE: 57,
  SHIFT: 42, SHIFT_R: 54, CTRL: 29, CTRL_R: 3613,
  ALT: 56, ALT_R: 3640, META: 3675, META_R: 3676,
  UP: 57416, DOWN: 57424, LEFT: 57419, RIGHT: 57421,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  MINUS: 12, EQUAL: 13, BRACKET_L: 26, BRACKET_R: 27, BACKSLASH: 43,
  SEMICOLON: 39, QUOTE: 40, COMMA: 51, PERIOD: 52, SLASH: 53, BACKQUOTE: 41,
};

// reverse map: code -> ชื่อปุ่ม
export const CODE_TO_NAME: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const name of Object.keys(KEY)) if (m[KEY[name]] === undefined) m[KEY[name]] = name;
  return m;
})();

const NICE: Record<string, string> = {
  SPACE: "Space", SHIFT: "Shift", SHIFT_R: "Shift", CTRL: "Ctrl", CTRL_R: "Ctrl",
  ALT: "Alt", ALT_R: "Alt", META: "Cmd", META_R: "Cmd", ESC: "Esc", TAB: "Tab",
  ENTER: "Enter", BACKSPACE: "Bksp", CAPS: "Caps",
  UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→",
  BACKQUOTE: "`", MINUS: "-", EQUAL: "=", BRACKET_L: "[", BRACKET_R: "]",
  BACKSLASH: "\\", SEMICOLON: ";", QUOTE: "'", COMMA: ",", PERIOD: ".", SLASH: "/",
};

export function suggestLabel(code: number): string {
  const n = CODE_TO_NAME[code];
  if (!n) return String(code);
  if (NICE[n]) return NICE[n];
  if (/^N[0-9]$/.test(n)) return n.slice(1);
  if (n.length === 1) return n;
  return n.charAt(0) + n.slice(1).toLowerCase();
}

export const KEY_OPTIONS = Object.keys(KEY)
  .sort()
  .map((name) => ({ name, code: KEY[name] }));

type RowItem = { code?: number; label?: string; width?: number; spacer?: number };

/** normalize เป็น flat array ของปุ่มพร้อมพิกัด (รับได้ทั้งรูปแถวเก่าและ flat ใหม่) — idempotent */
export function toFreeLayout(layout: unknown): KeyDef[] {
  if (!Array.isArray(layout) || layout.length === 0) return [];
  if (!Array.isArray(layout[0])) {
    return (layout as Record<string, unknown>[])
      .filter((k) => k && k.spacer == null)
      .map((k) => ({
        code: k.code as number | undefined,
        label: k.label as string | undefined,
        x: +(k.x as number) || 0,
        y: +(k.y as number) || 0,
        w: k.w != null ? +(k.w as number) : k.width != null ? +(k.width as number) : 1,
        h: k.h != null ? +(k.h as number) : 1,
      }));
  }
  const keys: KeyDef[] = [];
  (layout as RowItem[][]).forEach((row, y) => {
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

// default layout (เขียนแบบแถวเพื่ออ่านง่าย แล้วแปลงเป็นพิกัด)
const DEFAULT_ROWS: RowItem[][] = [
  [KEY.N1, KEY.N2, KEY.N3, KEY.N4, KEY.N5, KEY.N6, KEY.N7, KEY.N8, KEY.N9, KEY.N0].map((c) => ({ code: c, label: suggestLabel(c) })),
  [KEY.Q, KEY.W, KEY.E, KEY.R, KEY.T, KEY.Y, KEY.U, KEY.I, KEY.O, KEY.P].map((c) => ({ code: c, label: suggestLabel(c) })),
  [{ spacer: 0.5 }, ...[KEY.A, KEY.S, KEY.D, KEY.F, KEY.G, KEY.H, KEY.J, KEY.K, KEY.L].map((c) => ({ code: c, label: suggestLabel(c) }))],
  [{ spacer: 1.1 }, ...[KEY.Z, KEY.X, KEY.C, KEY.V, KEY.B, KEY.N, KEY.M].map((c) => ({ code: c, label: suggestLabel(c) })), { code: KEY.SHIFT_R, label: "Shift", width: 1.6 }, { code: KEY.UP, label: "↑" }],
  [{ code: KEY.CTRL, label: "Ctrl", width: 1.4 }, { code: KEY.ALT, label: "Alt", width: 1.2 }, { code: KEY.SPACE, label: "Space", width: 6.1 }, { code: KEY.LEFT, label: "←" }, { code: KEY.DOWN, label: "↓" }, { code: KEY.RIGHT, label: "→" }],
];

export const DEFAULT_LAYOUT: KeyDef[] = toFreeLayout(DEFAULT_ROWS);

/** ขนาดกล่อง = ขอบขวา/ล่างสุดของปุ่ม (หน่วยกริด) */
export function layoutExtent(keys: KeyDef[]): { cols: number; rows: number } {
  let cols = 0, rows = 0;
  for (const k of keys) {
    cols = Math.max(cols, (k.x || 0) + (k.w || 1));
    rows = Math.max(rows, (k.y || 0) + (k.h || 1));
  }
  return { cols, rows };
}
