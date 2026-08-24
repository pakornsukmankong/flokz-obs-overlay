"use client";

import { CSSProperties, Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const STALE_MS = 20000;
const ALIGN: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };
const JUSTIFY: Record<string, string> = { top: "flex-start", middle: "center", bottom: "flex-end" };

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export default function GrindOverlayPage() {
  return (
    <Suspense fallback={null}>
      <GrindOverlayInner />
    </Suspense>
  );
}

function GrindOverlayInner() {
  const params = useParams();
  const token = String(params.token);
  const q = useSearchParams();

  const size = clamp(parseFloat(q.get("size") || "") || 64, 16, 400);
  const strokeParam = q.get("stroke");
  const stroke = strokeParam === null || strokeParam === "" ? Math.max(2, size / 20) : clamp(parseFloat(strokeParam), 0, 24);
  const accent = q.get("accent") || "#ffcf5a";
  const label = q.get("label") ?? "รอบ";
  const stamina = q.get("stamina") === "1";
  const showDot = q.get("dot") !== "0";
  const align = q.get("align") || "left";
  const valign = q.get("valign") || "top";

  const [count, setCount] = useState(0);
  const [live, setLive] = useState(false);
  const [pop, setPop] = useState(0);

  // poll count ของ token นี้ทุก 1.5 วิ (แทน realtime)
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s: { count?: number; at?: number } = await (
          await fetch(`/api/grind?token=${encodeURIComponent(token)}`, { cache: "no-store" })
        ).json();
        if (!alive) return;
        if (typeof s.count === "number") setCount((prev) => { if (prev !== s.count) setPop((p) => p + 1); return s.count!; });
        setLive(typeof s.at === "number" && s.at > 0 && Date.now() - s.at < STALE_MS);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(iv); };
  }, [token]);

  const rootStyle: CSSProperties = {
    position: "fixed", inset: 0, display: "flex", flexDirection: "column",
    alignItems: ALIGN[align], justifyContent: JUSTIFY[valign],
    fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "transparent",
  };
  const numStyle: CSSProperties = { fontSize: size, color: accent, display: "inline-block", WebkitTextStroke: `${stroke}px #000` };
  const labelStyle: CSSProperties = { fontSize: size * 0.34, opacity: 0.92, WebkitTextStroke: `${stroke * 0.6}px #000` };
  const subStyle: CSSProperties = { fontSize: size * 0.24, fontWeight: 600, opacity: 0.8, padding: "0 12px 8px", color: "#fff", WebkitTextStroke: `${stroke * 0.55}px #000`, textShadow: "0 0 4px rgba(0,0,0,.9), 0 2px 6px rgba(0,0,0,.8)" };

  return (
    <div style={rootStyle}>
      <style>{`
        @keyframes ov-pop { 0%{transform:translateY(0.12em) scale(0.88);opacity:.4} 60%{transform:translateY(0) scale(1.06);opacity:1} 100%{transform:translateY(0) scale(1);opacity:1} }
        .ov-line{ display:flex; align-items:baseline; gap:.25em; padding:8px 12px; line-height:1; color:#fff; font-variant-numeric:tabular-nums; font-weight:700; text-shadow:0 0 4px rgba(0,0,0,.9),0 2px 6px rgba(0,0,0,.8),0 0 18px rgba(0,0,0,.6); }
        .ov-line .n,.ov-line .l{ paint-order: stroke fill; }
      `}</style>
      <div className="ov-line">
        {showDot && <span style={{ width: "0.28em", height: "0.28em", borderRadius: "50%", alignSelf: "center", background: live ? "#46c46b" : "#d8514b", boxShadow: "0 0 6px rgba(0,0,0,.8)" }} />}
        <span key={pop} className="n" style={{ ...numStyle, animation: "ov-pop 420ms cubic-bezier(0.2,0.9,0.3,1.4)" }}>{count}</span>
        {label && <span className="l" style={labelStyle}>{label}</span>}
      </div>
      {stamina && <div style={subStyle}>{count * 20} stamina</div>}
    </div>
  );
}
