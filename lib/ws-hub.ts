/**
 * ws-hub.ts — สะพานให้ Next Route Handler เรียก WebSocket hub ที่สร้างใน server.js
 * (instance จริงอยู่บน globalThis.__FLOKZ_HUB — ตั้งค่าจาก server.js)
 */
type Hub = {
  broadcast(obj: unknown): void;
  reloadProfile(id: string): void;
  relayGrind(state: unknown): void;
  talkReload(): void;
};

function hub(): Hub | null {
  return (globalThis as unknown as { __FLOKZ_HUB?: Hub }).__FLOKZ_HUB ?? null;
}

export function reloadProfile(id: string) { hub()?.reloadProfile(id); }
export function talkReload() { hub()?.talkReload(); }
export function broadcast(obj: unknown) { hub()?.broadcast(obj); }
