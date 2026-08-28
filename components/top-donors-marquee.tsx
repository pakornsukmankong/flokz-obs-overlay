import { CSSProperties } from "react";
import styles from "./top-donors.module.css";

export type TopDonor = { name: string; total: number };

const RANK_BG: Record<number, string> = { 1: "#ffcf5a", 2: "#cfd6e4", 3: "#e0925a" };

/** แถบ marquee เลื่อนวน (render แค่ track — parent เป็นคน crop/จัด container) */
export function TopDonorsMarquee({
  donors,
  speed = 30,
  dir = "right",
}: {
  donors: TopDonor[];
  speed?: number;
  dir?: "left" | "right";
}) {
  if (!donors.length) return null;
  const ranked = donors.map((d, i) => ({ ...d, rank: i + 1 }));
  // ทำ 1 ชุดให้กว้างพอ (≥8 ชิ้น) แล้ว double เพื่อ loop ไร้รอยต่อ
  const base: (TopDonor & { rank: number })[] = [];
  while (base.length < Math.max(8, ranked.length)) base.push(...ranked);
  const loop = [...base, ...base];

  return (
    <div
      className={`${styles.track} ${dir === "left" ? styles.left : styles.right}`}
      style={{ "--dur": `${speed}s` } as CSSProperties}
    >
      {loop.map((d, i) => (
        <div key={i} className={styles.item}>
          <span className={styles.rank} style={{ background: RANK_BG[d.rank] || "#7aa2f7" }}>{d.rank}</span>
          <span className={styles.name}>{d.name}</span>
          <span className={styles.total}>฿{d.total.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
