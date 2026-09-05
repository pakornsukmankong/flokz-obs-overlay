"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";

type Cfg = { talking: string | null; idle: string | null; threshold: number; hold: number };

const imgBase: CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "100vw",
  maxHeight: "100vh",
  objectFit: "contain",
  transition: "opacity 60ms linear, transform 90ms ease",
  pointerEvents: "none",
};

export default function TalkOverlayPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [talking, setTalking] = useState(false);
  const [hint, setHint] = useState("");
  const cfgRef = useRef({ threshold: 0.05, hold: 180 });

  // โหลด config + poll ทุก 3 วิ (แทน realtime — พอสำหรับ avatar)
  useEffect(() => {
    let alive = true;
    let lastJson = "";
    const load = async () => {
      try {
        // no-cache (ไม่ใช่ no-store): ให้เบราว์เซอร์แนบ If-None-Match เอง แล้วใช้ body ที่แคชไว้
        // ตอนได้ 304 กลับมา — กันโหลดรูป avatar ซ้ำทุก poll ทั้งที่ยังไม่เปลี่ยน
        const c: Cfg = await (await fetch("/api/talk", { cache: "no-cache" })).json();
        if (!alive) return;
        const j = JSON.stringify(c);
        if (j !== lastJson) { lastJson = j; setCfg(c); cfgRef.current = { threshold: c.threshold, hold: c.hold }; }
        if (!c.idle && !c.talking) setHint("ยังไม่ได้ตั้งค่ารูป — เปิด /talk-setup");
      } catch {}
    };
    load();
    const iv = setInterval(load, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // ไมค์
  useEffect(() => {
    let raf = 0;
    let ctx: AudioContext | null = null;
    let lastLoud = 0;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new Ctx();
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let s = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
          const rms = Math.sqrt(s / buf.length);
          const now = performance.now();
          if (rms > cfgRef.current.threshold) lastLoud = now;
          setTalking(now - lastLoud < (cfgRef.current.hold || 180));
          raf = requestAnimationFrame(loop);
        };
        loop();
        setHint("");
      } catch (e) {
        setHint("ไมค์ไม่ทำงาน: " + (e as Error).message + " (อนุญาตไมค์ให้เบราว์เซอร์/OBS)");
      }
    })();
    return () => { cancelAnimationFrame(raf); ctx?.close(); };
  }, []);

  if (!cfg) return null;
  const talkTransform = talking ? "translateX(-50%) translateY(-1.5%) scale(1.015)" : "translateX(-50%)";
  return (
    <div style={{ position: "fixed", inset: 0, background: "transparent" }}>
      {cfg.idle && <img src={cfg.idle} alt="" style={{ ...imgBase, opacity: 1, transform: talkTransform }} />}
      {cfg.talking && <img src={cfg.talking} alt="" style={{ ...imgBase, opacity: talking ? 1 : 0, transform: talkTransform }} />}
      {hint && (
        <div style={{ position: "absolute", top: 12, left: 12, fontSize: 12, color: "#ff6b6b", background: "rgba(0,0,0,.4)", padding: "4px 8px", borderRadius: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
