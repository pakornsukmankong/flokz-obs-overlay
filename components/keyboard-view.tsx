import { CSSProperties } from "react";
import { KeyDef, layoutExtent } from "@/lib/keyboard";
import styles from "./keyboard.module.css";

/** แสดงคีย์บอร์ดแบบอ่านอย่างเดียว (ใช้ในหน้า overlay) */
export function KeyboardView({
  layout,
  pressed,
}: {
  layout: KeyDef[];
  pressed: Set<number>;
}) {
  const { cols, rows } = layoutExtent(layout);
  const boxStyle = { "--cols": cols, "--rows": rows } as CSSProperties;
  return (
    <div className={styles.kb} style={boxStyle}>
      {layout.map((k, i) => {
        const isPressed = k.code != null && pressed.has(k.code);
        const style = {
          "--x": k.x,
          "--y": k.y,
          "--w": k.w ?? 1,
          "--h": k.h ?? 1,
        } as CSSProperties;
        return (
          <div key={i} className={`${styles.key} ${isPressed ? styles.pressed : ""}`} style={style}>
            <span className={styles.cap}>{k.label ?? ""}</span>
          </div>
        );
      })}
    </div>
  );
}
