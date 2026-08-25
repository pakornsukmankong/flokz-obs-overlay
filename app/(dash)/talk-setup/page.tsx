"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Mic, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const MAX_DIM = 700;
const METER_MAX = 0.3;

export default function TalkSetupPage() {
  const [talking, setTalking] = useState<string | null>(null);
  const [idle, setIdle] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.05);
  const [hold, setHold] = useState(180);
  const [dirty, setDirty] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [isTalking, setIsTalking] = useState(false);

  const thRef = useRef(0.05);
  const holdRef = useRef(180);
  useEffect(() => { thRef.current = threshold; }, [threshold]);
  useEffect(() => { holdRef.current = hold; }, [hold]);

  const [overlayUrl, setOverlayUrl] = useState("/talk");
  useEffect(() => { setOverlayUrl(`${location.origin}/talk`); }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await (await fetch("/api/talk", { cache: "no-store" })).json();
        setTalking(c.talking ?? null);
        setIdle(c.idle ?? null);
        setThreshold(c.threshold ?? 0.05);
        setHold(c.hold ?? 180);
      } catch {}
    })();
  }, []);

  const mark = () => setDirty(true);

  const fileToDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          const w = Math.round(img.width * s), h = Math.round(img.height * s);
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = fr.result as string;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const onFile = async (file: File | undefined, which: "talking" | "idle") => {
    if (!file) return;
    try {
      const url = await fileToDataURL(file);
      if (which === "talking") setTalking(url); else setIdle(url);
      mark();
    } catch { toast.error("อ่านรูปไม่สำเร็จ"); }
  };

  const startMic = async () => {
    if (micOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      setMicOn(true);
      let lastLoud = 0;
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; }
        const rms = Math.sqrt(s / buf.length);
        setLevel(Math.min(1, rms / METER_MAX));
        const now = performance.now();
        if (rms > thRef.current) lastLoud = now;
        setIsTalking(now - lastLoud < holdRef.current);
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { toast.error("เปิดไมค์ไม่ได้: " + (e as Error).message); }
  };

  const save = async () => {
    try {
      const r = await (await fetch("/api/talk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talking, idle, threshold, hold }),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setDirty(false);
      toast.success("บันทึกแล้ว — overlay /talk จะรีโหลดเอง");
    } catch (e) { toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message); }
  };

  const imgStyle: CSSProperties = { position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transition: "opacity 60ms" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-semibold tracking-wide">Talk Overlay — Setup</h1>
        <div className="ml-auto flex items-center gap-2">
          <code className="max-w-[240px] truncate rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-xs text-primary">{overlayUrl}</code>
          <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(overlayUrl); toast.success("คัดลอก URL แล้ว"); }}><Copy className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => window.open(overlayUrl, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
          <Button onClick={save} className="shadow-neon"><Save className="h-4 w-4" /> บันทึก{dirty ? " •" : ""}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="border-border/70 bg-[repeating-conic-gradient(#12151c_0%_25%,#171b24_0%_50%)] bg-[length:26px_26px] p-6">
          <div className="mx-auto flex h-[300px] w-[230px] items-end justify-center">
            <div className="relative h-full w-full">
              {idle && <img src={idle} alt="" style={{ ...imgStyle, opacity: 1 }} />}
              {talking && <img src={talking} alt="" style={{ ...imgStyle, opacity: isTalking ? 1 : 0 }} />}
              {!idle && !talking && <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">อัปโหลดรูป 2 รูปทางขวา<br />แล้วกด “ทดสอบไมค์”</div>}
            </div>
          </div>
          <div className="mx-auto mt-4 h-4 w-[260px] overflow-hidden rounded-full border border-border bg-secondary/40">
            <div className="relative h-full">
              <div className="h-full bg-gradient-to-r from-primary to-accent transition-[width]" style={{ width: `${level * 100}%` }} />
              <div className="absolute -top-0.5 bottom-[-2px] w-0.5 bg-destructive" style={{ left: `${Math.min(100, (threshold / METER_MAX) * 100)}%` }} />
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-semibold" style={{ color: isTalking ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
            {micOn ? (isTalking ? "🔊 กำลังพูด" : "🔇 เงียบ") : "— (กดทดสอบไมค์)"}
          </p>
        </Card>

        <Card className="h-fit space-y-4 border-border/70 bg-card/70 p-4">
          <div className="space-y-1.5">
            <Label>รูปตอนพูด (ปากอ้า)</Label>
            <input type="file" accept="image/*" className="block w-full text-xs text-muted-foreground" onChange={(e) => onFile(e.target.files?.[0], "talking")} />
            {talking && <img src={talking} alt="" className="mt-1 max-h-20 rounded border border-border" />}
          </div>
          <div className="space-y-1.5">
            <Label>รูปตอนเงียบ (ปากปิด)</Label>
            <input type="file" accept="image/*" className="block w-full text-xs text-muted-foreground" onChange={(e) => onFile(e.target.files?.[0], "idle")} />
            {idle && <img src={idle} alt="" className="mt-1 max-h-20 rounded border border-border" />}
          </div>

          <Button variant={micOn ? "secondary" : "outline"} className="w-full" onClick={startMic} disabled={micOn}>
            <Mic className="h-4 w-4" /> {micOn ? "กำลังฟัง…" : "เริ่มทดสอบไมค์"}
          </Button>

          <div className="space-y-1.5">
            <Label>ความไว (threshold): {threshold.toFixed(3)}</Label>
            <Slider min={0.01} max={0.3} step={0.005} value={[threshold]} onValueChange={(v) => { setThreshold(v[0]); mark(); }} />
          </div>
          <div className="space-y-1.5">
            <Label>หน่วงภาพ (hold): {hold} ms</Label>
            <Slider min={0} max={500} step={10} value={[hold]} onValueChange={(v) => { setHold(v[0]); mark(); }} />
          </div>
          <p className="text-xs text-muted-foreground">ปรับ threshold (เส้นแดง) ให้อยู่ระหว่างเสียงพูดกับเสียงเงียบ</p>
        </Card>
      </div>
    </div>
  );
}
