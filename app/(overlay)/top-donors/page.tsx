"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "@/components/top-donors.module.css";
import { TopDonorsMarquee, type TopDonor } from "@/components/top-donors-marquee";

export default function TopDonorsPage() {
  return (
    <Suspense fallback={null}>
      <TopDonorsInner />
    </Suspense>
  );
}

function TopDonorsInner() {
  const q = useSearchParams();
  const limit = Math.min(30, Math.max(1, parseInt(q.get("limit") || "10", 10) || 10));
  const speed = Math.min(180, Math.max(8, parseFloat(q.get("speed") || "30") || 30)); // วินาที/รอบ
  const dir = q.get("dir") === "left" ? "left" : "right"; // ดีฟอลต์เลื่อนขวา

  const [donors, setDonors] = useState<TopDonor[]>([]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const j = await (await fetch(`/api/easydonate/top?limit=${limit}`, { cache: "no-store" })).json();
        if (alive) setDonors(j.donors || []);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, [limit]);

  return (
    <div className={styles.wrap}>
      <TopDonorsMarquee donors={donors} speed={speed} dir={dir} />
    </div>
  );
}
