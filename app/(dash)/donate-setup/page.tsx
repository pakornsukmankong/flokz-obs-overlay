"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Save, Send, Heart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DonationAlertCard, type AlertDonation } from "@/components/donation-alert";
import { speakDonation, speak, loadVoices } from "@/lib/tts";
import { Volume2 } from "lucide-react";

export default function DonateSetupPage() {
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [minAmount, setMinAmount] = useState(0);
  const [durationMs, setDurationMs] = useState(6000);
  const [tts, setTts] = useState(true);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [dirty, setDirty] = useState(false);
  const [testName, setTestName] = useState("ผู้ทดสอบใจดี");
  const [testAmount, setTestAmount] = useState(99);
  const [testMsg, setTestMsg] = useState("ทดสอบ alert 🎉");
  const [preview, setPreview] = useState<AlertDonation | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // คำนวณ URL ฝั่ง client เท่านั้น (กัน hydration mismatch)
  const [overlayUrl, setOverlayUrl] = useState("/donate-alert");
  useEffect(() => { setOverlayUrl(`${location.origin}/donate-alert`); }, []);

  useEffect(() => loadVoices(setVoices), []); // โหลดรายการเสียงในเครื่อง

  useEffect(() => {
    (async () => {
      try {
        const c = await (await fetch("/api/easydonate/config", { cache: "no-store" })).json();
        setConfigured(!!c.configured);
        setMinAmount(c.minAmount ?? 0);
        setDurationMs(c.durationMs ?? 6000);
        setTts(c.tts !== false);
        setVoiceURI(c.voiceURI ?? "");
        setRate(c.rate ?? 1);
      } catch {}
    })();
  }, []);

  const mark = () => setDirty(true);
  const thaiVoices = voices.filter((v) => /^th/i.test(v.lang)); // เฉพาะเสียงภาษาไทย

  const save = async () => {
    try {
      const body: Record<string, unknown> = { minAmount, durationMs, tts, voiceURI: voiceURI || null, rate };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const r = await (await fetch("/api/easydonate/config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })).json();
      if (!r.ok) throw new Error(r.error);
      setConfigured(!!r.configured);
      setApiKey("");
      setDirty(false);
      toast.success("บันทึกแล้ว");
    } catch (e) { toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message); }
  };

  const sendTest = async () => {
    // โชว์ preview ในหน้านี้ทันที + อ่านออกเสียง (ถ้าเปิด)
    const d = { id: "preview_" + Date.now(), name: testName || "Anonymous", amount: testAmount, message: testMsg };
    setPreview(d);
    speakDonation(d, { enabled: tts, voiceURI: voiceURI || null, rate });
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreview(null), durationMs);
    // ยิงเข้า queue ด้วย เผื่อเปิดหน้า overlay จริงใน OBS ค้างไว้
    try {
      await fetch("/api/easydonate/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testName, amount: testAmount, message: testMsg }),
      });
    } catch { toast.error("ส่งเข้า overlay จริงไม่สำเร็จ (preview ยังเห็นได้)"); }
  };
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-semibold tracking-wide">Donation Alert — Setup</h1>
        {configured && (
          <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> เชื่อม EasyDonate แล้ว
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <code className="max-w-[220px] truncate rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-xs text-primary">{overlayUrl}</code>
          <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(overlayUrl); toast.success("คัดลอก URL แล้ว"); }}><Copy className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => window.open(overlayUrl, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
          <Button onClick={save} className="shadow-neon"><Save className="h-4 w-4" /> บันทึก{dirty ? " •" : ""}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 border-border/70 bg-card/70 p-5">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">เชื่อม EasyDonate</h2>
          <div className="space-y-1.5">
            <Label>API Key (scope <code className="text-primary">read:donations</code>)</Label>
            <Input type="password" value={apiKey} onChange={(e) => { setApiKey(e.target.value); mark(); }}
              placeholder={configured ? "•••••••• (ตั้งไว้แล้ว — กรอกใหม่เพื่อเปลี่ยน)" : "ezdn_v1_..."} />
            <p className="text-xs text-muted-foreground">
              สร้างที่ <a className="text-primary underline" href="https://easydonate.app/dashboard/developer?tab=apiKeys" target="_blank" rel="noreferrer">developer dashboard</a> ของ EasyDonate — key ถูกเก็บฝั่ง server เท่านั้น ไม่โผล่บน overlay
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>ยอดขั้นต่ำที่จะขึ้น alert: ฿{minAmount}</Label>
            <Slider min={0} max={500} step={5} value={[minAmount]} onValueChange={(v) => { setMinAmount(v[0]); mark(); }} />
          </div>
          <div className="space-y-1.5">
            <Label>เวลาโชว์ alert: {(durationMs / 1000).toFixed(1)} วิ</Label>
            <Slider min={2000} max={20000} step={500} value={[durationMs]} onValueChange={(v) => { setDurationMs(v[0]); mark(); }} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <Label>อ่านออกเสียง (TTS)</Label>
              <p className="text-xs text-muted-foreground">อ่าน “ชื่อ โดเนท ยอด บาท + ข้อความ” ด้วยเสียงเบราว์เซอร์</p>
            </div>
            <Switch checked={tts} onCheckedChange={(v) => { setTts(v); mark(); }} />
          </div>

          {tts && (
            <>
              <div className="space-y-1.5">
                <Label>เสียงพูด</Label>
                <div className="flex gap-2">
                  <select
                    value={voiceURI}
                    onChange={(e) => { setVoiceURI(e.target.value); mark(); }}
                    className="h-9 flex-1 rounded-md border border-input bg-secondary/40 px-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">อัตโนมัติ (เสียงไทยถ้ามี)</option>
                    {thaiVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                  </select>
                  <Button variant="outline" size="icon" title="ทดสอบเสียง"
                    onClick={() => speak(testMsg || "ทดสอบเสียง สวัสดีครับ", { enabled: true, voiceURI: voiceURI || null, rate })}>
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
                {thaiVoices.length === 0 && <p className="text-xs text-muted-foreground">ไม่พบเสียงภาษาไทยในเครื่องนี้ — ใช้ “อัตโนมัติ” ได้ (จะใช้เสียงไทยถ้าเบราว์เซอร์/OBS ปลายทางมี) หรือติดตั้งเสียงไทยเพิ่มใน OS</p>}
              </div>
              <div className="space-y-1.5">
                <Label>ความเร็วเสียง: {rate.toFixed(1)}x</Label>
                <Slider min={0.5} max={2} step={0.1} value={[rate]} onValueChange={(v) => { setRate(v[0]); mark(); }} />
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-4 border-border/70 bg-card/70 p-5">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">ทดสอบ alert</h2>
          <p className="text-xs text-muted-foreground">เปิดหน้า overlay ไว้อีกแท็บ แล้วกดส่ง — จะเห็นอนิเมชั่นเด้งขึ้น (ทดสอบได้โดยไม่ต้องมีโดเนทจริง)</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1"><Label>ชื่อผู้โดเนท</Label><Input value={testName} onChange={(e) => setTestName(e.target.value)} /></div>
            <div className="space-y-1"><Label>ยอด (฿)</Label><Input type="number" value={testAmount} onChange={(e) => setTestAmount(Number(e.target.value) || 0)} /></div>
          </div>
          <div className="space-y-1"><Label>ข้อความ</Label><Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} /></div>
          <Button variant="outline" className="w-full" onClick={sendTest}><Send className="h-4 w-4" /> ส่ง alert ทดสอบ</Button>
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>overlay นี้ <b>อ่านโดเนท</b>จาก EasyDonate มาโชว์ — การรับเงินจริงเกิดที่หน้า donation page ของ EasyDonate (ไม่ได้ตัดเงินผ่านที่นี่)</span>
          </div>
        </Card>
      </div>

      <Card className="border-border/70 p-0">
        <div className="border-b border-border/60 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">พรีวิว (เหมือนที่จะขึ้นบน overlay)</div>
        <div
          className="flex min-h-[200px] items-start justify-center p-8"
          style={{
            backgroundColor: "#1b1e24",
            backgroundImage:
              "repeating-conic-gradient(#12151c 0% 25%, #171b24 0% 50%)",
            backgroundSize: "26px 26px",
          }}
        >
          {preview ? (
            <DonationAlertCard donation={preview} />
          ) : (
            <span className="self-center text-sm text-muted-foreground">กด “ส่ง alert ทดสอบ” เพื่อดูตัวอย่างที่นี่</span>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground">เอา <code className="text-primary">{overlayUrl}</code> ไปใส่ OBS → Browser Source (พื้นหลังโปร่งใส)</p>
    </div>
  );
}
