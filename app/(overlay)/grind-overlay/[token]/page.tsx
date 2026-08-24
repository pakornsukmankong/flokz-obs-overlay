"use client";

import { CSSProperties, Suspense, useEffect, useRef, useState } from "react";
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
  const lastSeen = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null, stop = false, t: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (stop) return;
      ws = new WebSocket(`ws://${location.host}`);
      ws.onopen = () => ws?.send(JSON.stringify({ type: "grind-hello", token }));
      ws.onmessage = (ev) => {
        let d: { type?: string; token?: string; count?: number };
        try { d = JSON.parse(ev.data); } catch { return; }
        if (d.type === "grind-state" && d.token === token && typeof d.count === "number") {
          lastSeen.current = Date.now(); setLive(true);
          setCount((prev) => { if (prev !== d.count) setPop((p) => p + 1); return d.count!; });
        }
      };
      ws.onclose = () => { setLive(false); t = setTimeout(connect, 1500); };
      ws.onerror = () => ws?.close();
    };
    connect();
    const iv = setInterval(() => setLive(Date.now() - lastSeen.current < STALE_MS), 2000);
    return () => { stop = true; clearTimeout(t); clearInterval(iv); ws?.close(); };
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
