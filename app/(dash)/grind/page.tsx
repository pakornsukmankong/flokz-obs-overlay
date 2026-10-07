"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Monitor, Plus, Minus, RotateCcw, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  MASK_N, MASK_W, MASK_H, SEARCH_W, buildTemplate, toGray, scoreMask, searchGray,
  type Region, type Template,
} from "@/lib/detector";

const DEFAULT_REGION: Region = { x: 35.4, y: 16.2, w: 24.5, h: 16.7 };
const DEFAULT_CUTOFF = 140, DEFAULT_MIN_SCORE = 0.6, DEFAULT_MIN_GAP = 10;
const SAMPLE_MS = 400, CONFIRM_FRAMES = 2, RELEASE_RATIO = 0.7, GAP_WARN_MS = 2500, OVERLAY_BEAT_MS = 15000;
const TUNING_VERSION = 3;
const LS_REGION = "flokz-grind-region", LS_TUNING = "flokz-grind-tuning", LS_RUNS = "flokz-grind-runs", LS_OVERLAY = "flokz-grind-overlay";

type Run = { id: number; at: number; manual?: boolean };

export default function GrindPage() {
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [cutoff, setCutoff] = useState(DEFAULT_CUTOFF);
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
  const [minGap, setMinGap] = useState(DEFAULT_MIN_GAP);
  const [live, setLive] = useState(0);
  const [peak, setPeak] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const [rate, setRate] = useState(0);
  const [maxGap, setMaxGap] = useState(0);
  const [workerDown, setWorkerDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayKey, setOverlayKey] = useState<string | null>(null);
  const [overlaySize, setOverlaySize] = useState(64);
  const [overlayStroke, setOverlayStroke] = useState<number | "">("");
  const [overlayStamina, setOverlayStamina] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const tplRef = useRef<HTMLCanvasElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const scanRef = useRef<HTMLCanvasElement | null>(null);
  const grayRef = useRef(new Uint8Array(MASK_N));
  const idRef = useRef(0);
  const tplRefObj = useRef<Template | null>(null);

  const cfgRef = useRef({ cutoff, minScore, minGap });
  const regionRef = useRef(region);
  const lockedRef = useRef(locked);
  useEffect(() => { cfgRef.current = { cutoff, minScore, minGap }; }, [cutoff, minScore, minGap]);
  useEffect(() => { regionRef.current = region; }, [region]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  if (!tplRefObj.current) tplRefObj.current = buildTemplate();
  const count = runs.length;

  // ---- persistence restore ----
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(LS_REGION) || "null");
      if (r && typeof r.x === "number") setRegion(r);
      const saved: Run[] = JSON.parse(localStorage.getItem(LS_RUNS) || "null");
      if (Array.isArray(saved) && saved.length) { setRuns(saved); idRef.current = Math.max(...saved.map((x) => x.id)); }
      const k = localStorage.getItem(LS_OVERLAY);
      if (k && /^[a-z0-9]{8,40}$/i.test(k)) setOverlayKey(k);
      const t = JSON.parse(localStorage.getItem(LS_TUNING) || "null");
      if (t && t.v === TUNING_VERSION) {
        if (typeof t.cutoff === "number") setCutoff(t.cutoff);
        if (typeof t.minScore === "number") setMinScore(t.minScore);
        if (typeof t.minGap === "number") setMinGap(t.minGap);
      }
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(LS_REGION, JSON.stringify(region)); }, [hydrated, region]);
  useEffect(() => { if (hydrated) localStorage.setItem(LS_RUNS, JSON.stringify(runs)); }, [hydrated, runs]);
  useEffect(() => { if (hydrated) localStorage.setItem(LS_TUNING, JSON.stringify({ v: TUNING_VERSION, cutoff, minScore, minGap })); }, [hydrated, cutoff, minScore, minGap]);

  // ---- template preview ----
  useEffect(() => {
    const c = tplRef.current; const ctx = c?.getContext("2d"); const tpl = tplRefObj.current;
    if (!c || !ctx || !tpl) return;
    const img = ctx.createImageData(MASK_W, MASK_H);
    for (let i = 0; i < MASK_N; i++) {
      img.data[i * 4] = tpl.on.data[i] ? 255 : 0;
      img.data[i * 4 + 1] = tpl.on.data[i] ? 190 : 0;
      img.data[i * 4 + 2] = 0; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  // ---- push count ไป /api/grind (overlay ฝั่ง OBS poll เอา) + heartbeat ให้จุด live เขียว ----
  const overlayKeyRef = useRef(overlayKey);
  const runsRef = useRef(runs);
  useEffect(() => { overlayKeyRef.current = overlayKey; }, [overlayKey]);
  useEffect(() => { runsRef.current = runs; }, [runs]);
  const pushOverlay = useCallback(() => {
    const key = overlayKeyRef.current;
    if (!key) return;
    const r = runsRef.current;
    const lastAt = r.length ? r[r.length - 1].at : null;
    fetch("/api/grind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, count: r.length, lastAt }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  useEffect(() => { pushOverlay(); }, [runs, overlayKey, pushOverlay]);
  useEffect(() => { const iv = setInterval(pushOverlay, OVERLAY_BEAT_MS); return () => clearInterval(iv); }, [pushOverlay]);

  const overlayUrl = (() => {
    if (!overlayKey || typeof window === "undefined") return "";
    const q = new URLSearchParams();
    if (overlaySize !== 64) q.set("size", String(overlaySize));
    if (overlayStroke !== "") q.set("stroke", String(overlayStroke));
    if (overlayStamina) q.set("stamina", "1");
    const qs = q.toString();
    return `${location.origin}/grind-overlay/${overlayKey}${qs ? "?" + qs : ""}`;
  })();

  const addRun = useCallback((manual = false) => {
    const id = ++idRef.current;
    setRuns((r) => [...r, { id, at: Date.now(), manual }]);
  }, []);

  // ---- sampling ----
  const sampleLocked = useCallback((): number | null => {
    const video = videoRef.current, tpl = tplRefObj.current;
    if (!video?.videoWidth || !tpl) return null;
    const work = (workRef.current ??= document.createElement("canvas"));
    if (work.width !== MASK_W) { work.width = MASK_W; work.height = MASK_H; }
    const wctx = work.getContext("2d", { willReadFrequently: true })!;
    const r = regionRef.current;
    const sx = (r.x / 100) * video.videoWidth, sy = (r.y / 100) * video.videoHeight;
    const sw = (r.w / 100) * video.videoWidth, sh = (r.h / 100) * video.videoHeight;
    wctx.drawImage(video, sx, sy, sw, sh, 0, 0, MASK_W, MASK_H);
    const gray = toGray(wctx.getImageData(0, 0, MASK_W, MASK_H).data, grayRef.current);
    const cut = cfgRef.current.cutoff;
    const mctx = maskRef.current?.getContext("2d");
    if (mctx) {
      const out = mctx.createImageData(MASK_W, MASK_H);
      for (let i = 0; i < MASK_N; i++) { const v = gray[i] >= cut ? 255 : 0; out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255; }
      mctx.putImageData(out, 0, 0);
    }
    const crop = cropRef.current, cctx = crop?.getContext("2d");
    if (crop && cctx) cctx.drawImage(video, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    return scoreMask(gray, tpl.on, tpl.off, cut);
  }, []);

  const grabGray = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const sw = SEARCH_W, sh = Math.round((sw * video.videoHeight) / video.videoWidth);
    const c = (scanRef.current ??= document.createElement("canvas"));
    if (c.width !== sw || c.height !== sh) { c.width = sw; c.height = sh; }
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, sw, sh);
    const gray = new Uint8Array(sw * sh);
    toGray(ctx.getImageData(0, 0, sw, sh).data, gray);
    return { gray, sw, sh };
  }, []);

  const start = async () => {
    setError(null);
    try {
      const opts = { video: { frameRate: 10, displaySurface: "window" }, audio: false, selfBrowserSurface: "exclude" } as DisplayMediaStreamOptions;
      const stream = await navigator.mediaDevices.getDisplayMedia(opts);
      const video = videoRef.current; if (!video) return;
      video.srcObject = stream; await video.play();
      stream.getVideoTracks()[0]?.addEventListener("ended", () => { setRunning(false); if (videoRef.current) videoRef.current.srcObject = null; });
      setMaxGap(0); setRunning(true);
    } catch (e) {
      setError((e as Error).name === "NotAllowedError" ? "ยกเลิกการแชร์หน้าจอ หรือเบราว์เซอร์ไม่อนุญาต" : "เริ่มจับหน้าจอไม่สำเร็จ");
    }
  };
  const stop = useCallback(() => {
    const video = videoRef.current;
    (video?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setRunning(false);
  }, []);
  useEffect(() => stop, [stop]);

  // ---- sampling loop ----
  useEffect(() => {
    if (!running) return;
    const video = videoRef.current; if (!video) return;
    let disposed = false, busy = false, seq = 0, lastSample = 0, above = 0, armed = true, lastHit = 0, lockDims = "";
    const stamps: number[] = [];
    let worker: Worker | null = null;
    try { worker = new Worker(new URL("./scan.worker.ts", import.meta.url)); } catch { worker = null; }
    if (!worker) setWorkerDown(true);

    const lockOnto = (r: Region) => { regionRef.current = r; lockedRef.current = true; lockDims = `${video.videoWidth}x${video.videoHeight}`; setRegion(r); setLocked(true); };
    const applyScore = (s: number, found: Region | null) => {
      if (disposed) return;
      setLive(s); setPeak((p) => (s > p ? s : p));
      const cfg = cfgRef.current;
      if (s >= cfg.minScore) {
        above++;
        if (above >= CONFIRM_FRAMES) {
          if (found) lockOnto(found);
          const now = Date.now();
          if (armed && now - lastHit >= cfg.minGap * 1000) { armed = false; lastHit = now; addRun(false); }
        }
      } else { above = 0; if (s < cfg.minScore * RELEASE_RATIO) armed = true; }
    };
    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      if (lastSample && now - lastSample < SAMPLE_MS) return;
      if (lastSample) { const gap = now - lastSample; setMaxGap((g) => (gap > g ? gap : g)); }
      lastSample = now;
      stamps.push(now); if (stamps.length > 16) stamps.shift();
      if (stamps.length > 1) setRate(((stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0])) * 1000);
      if (lockedRef.current) {
        if (lockDims && `${video.videoWidth}x${video.videoHeight}` !== lockDims) { lockedRef.current = false; setLocked(false); return; }
        const s = sampleLocked(); if (s !== null) applyScore(s, null); return;
      }
      if (busy) return;
      const g = grabGray(); if (!g) return;
      if (worker) { busy = true; worker.postMessage({ type: "scan", seq: ++seq, gray: g.gray.buffer, sw: g.sw, sh: g.sh, cutoff: cfgRef.current.cutoff }, [g.gray.buffer]); }
      else { const found = searchGray(g.gray, g.sw, g.sh, cfgRef.current.cutoff, tplRefObj.current!); if (found) applyScore(found.score, found.region); }
    };
    if (worker) {
      worker.addEventListener("message", (e: MessageEvent) => { const m = e.data; if (m?.type === "tick") tick(); else if (m?.type === "scan") { busy = false; if (m.found) applyScore(m.found.score, m.found.region); } });
      worker.addEventListener("error", () => { worker?.terminate(); worker = null; setWorkerDown(true); });
      worker.postMessage({ type: "clock", ms: SAMPLE_MS });
    }
    const interval = setInterval(tick, SAMPLE_MS);
    let rvfc = 0;
    const onFrame = () => { if (disposed) return; tick(); rvfc = video.requestVideoFrameCallback(onFrame); };
    if ("requestVideoFrameCallback" in video) rvfc = video.requestVideoFrameCallback(onFrame);
    return () => { disposed = true; clearInterval(interval); if (rvfc) video.cancelVideoFrameCallback(rvfc); worker?.terminate(); };
  }, [running, addRun, sampleLocked, grabGray]);

  const createOverlay = () => {
    const k = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 20);
    localStorage.setItem(LS_OVERLAY, k); setOverlayKey(k);
  };
  const resetCounter = () => { setRuns([]); setPeak(0); setMaxGap(0); idRef.current = 0; };
  const rehunt = () => { setLocked(false); lockedRef.current = false; setLive(0); setPeak(0); };
  const stalled = running && maxGap > GAP_WARN_MS;
  const recent = runs.slice(-40).reverse();
  const boxStyle: CSSProperties = { left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-wide">ตัวนับรอบดันอัตโนมัติ <span className="text-muted-foreground">(ทดลอง)</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">จับภาพหน้าจอเกมแล้วนับเมื่อเจอ “MISSION START” — เลือกแท็บ “หน้าต่าง” แล้วเลือกหน้าต่างเกม (Windowed/Borderless)</p>
      </div>

      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {!running ? <Button onClick={start} className="shadow-neon"><Monitor className="h-4 w-4" /> เริ่มจับหน้าจอ</Button>
          : <Button variant="outline" onClick={stop} className="text-destructive">หยุด</Button>}
        <Button variant="outline" size="sm" onClick={rehunt} disabled={!locked}><Crosshair className="h-4 w-4" /> หาตำแหน่งใหม่</Button>
        <span className="text-xs text-muted-foreground">{!running ? "ยังไม่ได้จับหน้าจอ" : locked ? "ล็อกตำแหน่งแล้ว — กำลังนับ" : "กำลังหาตำแหน่ง… ลงดันได้เลย"}</span>
      </div>

      {stalled && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">เคยมีช่วงตรวจจับห่างถึง {(maxGap / 1000).toFixed(1)} วิ — อาจนับตก ลองเปิดแท็บนี้ให้เห็นค้างไว้</div>}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="relative overflow-hidden border-border/70 bg-black p-0">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} muted playsInline className="block w-full" />
          <div className="pointer-events-none absolute border-2 border-neon-gold" style={boxStyle} />
          {!running && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">ยังไม่ได้จับหน้าจอ</div>}
        </Card>

        <div className="space-y-3">
          <Card className="border-border/70 bg-card/70 p-4">
            <div className="font-display text-3xl font-bold tabular-nums text-neon-gold text-glow-gold">{count}<span className="ml-2 text-sm font-normal text-muted-foreground">รอบ</span></div>
            <div className="text-xs text-muted-foreground">≈ {count * 20} stamina · ล่าสุด {recent[0] ? new Date(recent[0].at).toLocaleTimeString() : "—"}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button variant="outline" size="sm" onClick={() => addRun(true)}><Plus className="h-3 w-3" /> 1</Button>
              <Button variant="outline" size="sm" onClick={() => setRuns((r) => r.slice(0, -1))} disabled={!count}><Minus className="h-3 w-3" /> 1</Button>
              <Button variant="outline" size="sm" onClick={resetCounter}><RotateCcw className="h-3 w-3" /> รีเซ็ต</Button>
            </div>
          </Card>

          <Card className="border-border/70 bg-card/70 p-4 text-xs">
            <div className="mb-1 text-muted-foreground">ความเหมือนตอนนี้</div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-secondary/50"><div className="h-full bg-neon-gold transition-[width]" style={{ width: `${Math.round(live * 100)}%` }} /></div>
            <div className="tabular-nums">{(live * 100).toFixed(1)}% (ต้องถึง {(minScore * 100).toFixed(0)}%)</div>
            <div className="tabular-nums text-muted-foreground">สูงสุด {(peak * 100).toFixed(1)}%{running && ` · ${rate.toFixed(1)}/วิ · ห่างสุด ${(maxGap / 1000).toFixed(1)}วิ`}{workerDown && " · ไม่มี worker"}</div>
            <div className="mt-2 space-y-1">
              <canvas ref={cropRef} width={192} height={72} className="w-full rounded border border-border" />
              <div className="flex gap-1">
                <canvas ref={maskRef} width={MASK_W} height={MASK_H} className="w-1/2 rounded border border-border [image-rendering:pixelated]" />
                <canvas ref={tplRef} width={MASK_W} height={MASK_H} className="w-1/2 rounded border border-border [image-rendering:pixelated]" />
              </div>
              <div className="text-[10px] text-muted-foreground">ซ้าย = ที่เห็นจริง · ขวา = แม่แบบ (ตอนแบนเนอร์ขึ้นควรทับกันพอดี)</div>
            </div>
          </Card>
        </div>
      </div>

      {/* OBS overlay */}
      <Card className="border-border/70 bg-card/70 p-4">
        <div className="mb-2 font-display text-sm uppercase tracking-widest text-muted-foreground">โชว์จำนวนรอบบนสตรีม (OBS)</div>
        {!overlayKey ? (
          <Button variant="outline" size="sm" onClick={createOverlay}>สร้างลิงก์สำหรับ OBS</Button>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={overlayUrl} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(overlayUrl); toast.success("คัดลอกแล้ว"); }}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => window.open(overlayUrl, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={createOverlay}>สร้างลิงก์ใหม่</Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">ขนาด<Input type="number" min={16} max={300} step={4} value={overlaySize} onChange={(e) => setOverlaySize(Math.min(300, Math.max(16, Number(e.target.value) || 64)))} className="w-20" />px</label>
              <label className="flex items-center gap-2">ขอบดำ<Input type="number" min={0} max={16} step={0.5} placeholder="auto" value={overlayStroke} onChange={(e) => setOverlayStroke(e.target.value === "" ? "" : Math.min(16, Math.max(0, Number(e.target.value))))} className="w-20" />px</label>
              <label className="flex items-center gap-2"><Switch checked={overlayStamina} onCheckedChange={setOverlayStamina} /> แสดง stamina</label>
            </div>
          </div>
        )}
      </Card>

      {/* tuning */}
      <Card className="border-border/70 bg-card/70 p-4">
        <div className="mb-3 font-display text-sm uppercase tracking-widest text-muted-foreground">ตั้งค่าละเอียด (ปกติไม่ต้องแตะ)</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <div key={k} className="space-y-1"><Label className="text-xs uppercase">กรอบ {k} (%)</Label>
              <Input type="number" step="0.1" value={region[k]} onChange={(e) => setRegion((r) => ({ ...r, [k]: Number(e.target.value) }))} /></div>
          ))}
          <div className="space-y-1"><Label className="text-xs">ความสว่างขั้นต่ำ ({cutoff})</Label><Slider min={80} max={250} step={1} value={[cutoff]} onValueChange={(v) => setCutoff(v[0])} /></div>
          <div className="space-y-1"><Label className="text-xs">เกณฑ์ความเหมือน ({(minScore * 100).toFixed(0)}%)</Label><Slider min={20} max={95} step={1} value={[minScore * 100]} onValueChange={(v) => setMinScore(v[0] / 100)} /></div>
          <div className="space-y-1"><Label className="text-xs">เว้นระยะ ({minGap} วิ)</Label><Slider min={0} max={60} step={5} value={[minGap]} onValueChange={(v) => setMinGap(v[0])} /></div>
          <Button variant="outline" size="sm" className="self-end" onClick={() => { setRegion(DEFAULT_REGION); setCutoff(DEFAULT_CUTOFF); setMinScore(DEFAULT_MIN_SCORE); setMinGap(DEFAULT_MIN_GAP); }}>คืนค่าเริ่มต้น</Button>
        </div>
      </Card>

      {recent.length > 0 && (
        <Card className="border-border/70 bg-card/70 p-4">
          <div className="mb-2 text-sm font-medium">ประวัติการตรวจเจอ <span className="text-xs text-muted-foreground">(กด × เพื่อลบรอบที่นับผิด)</span></div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
            {recent.map((r, i) => (
              <li key={r.id}>
                <span className={r.manual ? "text-neon-gold" : ""}>#{count - i} · {new Date(r.at).toLocaleTimeString()}</span>
                <button onClick={() => setRuns((all) => all.filter((x) => x.id !== r.id))} className="ml-1 hover:text-destructive">×</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
