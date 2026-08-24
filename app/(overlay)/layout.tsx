/**
 * layout สำหรับหน้า overlay (OBS) — พื้นโปร่งใส ไม่มี navbar/chrome
 * body ถูกตั้ง background: transparent ไว้แล้วใน globals.css
 */
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
