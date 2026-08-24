"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Plus, Radio, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyDef, DEFAULT_LAYOUT, toFreeLayout, layoutExtent, KEY, KEY_OPTIONS,
  CODE_TO_NAME, suggestLabel,
} from "@/lib/keyboard";
import kb from "@/components/keyboard.module.css";

const CELL = 66; // = --key-size(58) + --key-gap(8) ตรงกับ keyboard.module.css
type Profile = { id: string; name: string };

export default function KeyboardEditorPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [layout, setLayout] = useState<KeyDef[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dialog, setDialog] = useState<null | "new" | "rename">(null);
  const [nameInput, setNameInput] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef(false);
  const selRef = useRef<number | null>(null);
  useEffect(() => { recRef.current = recording; }, [recording]);
  useEffect(() => { selRef.current = sel; }, [sel]);

  const markDirty = useCallback(() => setDirty(true), []);
  const overlayUrl = currentId ? `${typeof window !== "undefined" ? location.origin : ""}/overlay/${currentId}` : "";

  // ---- โหลด profiles + profile ปัจจุบัน ----
  const loadProfile = useCallback(async (id: string) => {
    try {
      const j = await (await fetch("/api/profiles/" + id, { cache: "no-store" })).json();
      const l = Array.isArray(j.layout) && j.layout.length ? toFreeLayout(j.layout) : structuredClone(DEFAULT_LAYOUT);
      setLayout(l);
    } catch {
      setLayout(structuredClone(DEFAULT_LAYOUT));
    }
    setCurrentId(id);
    localStorage.setItem("flokz.profile", id);
    setSel(null); setDirty(false);
  }, []);

  useEffect(() => {
    (async () => {
      let list: Profile[] = [];
      try { list = (await (await fetch("/api/profiles")).json()).profiles ?? []; } catch {}
      setProfiles(list);
      const last = localStorage.getItem("flokz.profile");
      const id = list.some((p) => p.id === last) ? last! : list[0]?.id ?? null;
      if (id) await loadProfile(id);
    })();
  }, [loadProfile]);

  // ---- WebSocket (สำหรับ Record) ----
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (stop) return;
      const ws = new WebSocket(`ws://${location.host}`);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        let d: { type?: string; keycode?: number };
        try { d = JSON.parse(ev.data); } catch { return; }
        if (recRef.current && d.type === "down" && d.keycode != null && selRef.current != null) {
          const code = d.keycode;
          setLayout((L) => L.map((k, i) => (i === selRef.current ? { ...k, code, label: suggestLabel(code) } : k)));
          setRecording(false); setDirty(true);
          toast.success("จับปุ่มได้: " + suggestLabel(code));
        }
      };
      ws.onclose = () => { timer = setTimeout(connect, 1500); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { stop = true; clearTimeout(timer); wsRef.current?.close(); };
  }, []);

  // ---- drag ปุ่มแบบวางอิสระ (snap 0.25, Alt = 0.05 ละเอียด) ----
  const dragRef = useRef<null | { i: number; sx: number; sy: number; kx: number; ky: number; moved: boolean }>(null);
  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    if (Math.abs(e.clientX - d.sx) > 3 || Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    const step = e.altKey ? 0.05 : 0.25;
    const nx = Math.max(0, Math.round((d.kx + (e.clientX - d.sx) / CELL) / step) * step);
    const ny = Math.max(0, Math.round((d.ky + (e.clientY - d.sy) / CELL) / step) * step);
    const rx = Math.round(nx * 100) / 100, ry = Math.round(ny * 100) / 100;
    setLayout((L) => L.map((k, idx) => (idx === d.i ? { ...k, x: rx, y: ry } : k)));
  }, []);
  const onUp = useCallback(() => {
    if (dragRef.current?.moved) markDirty();
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove, markDirty]);
  const onKeyDown = (i: number, e: React.PointerEvent) => {
    e.preventDefault();
    setSel(i); setRecording(false);
    const k = layout[i];
    dragRef.current = { i, sx: e.clientX, sy: e.clientY, kx: k.x, ky: k.y, moved: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ---- แก้ไขปุ่มที่เลือก ----
  const patch = (p: Partial<KeyDef>) => {
    if (sel == null) return;
    setLayout((L) => L.map((k, i) => (i === sel ? { ...k, ...p } : k)));
    markDirty();
  };
  const addKey = () => {
    const { rows } = layoutExtent(layout);
    const nk: KeyDef = { code: KEY.A, label: "A", x: 0, y: rows, w: 1, h: 1 };
    setLayout((L) => [...L, nk]);
    setSel(layout.length); markDirty();
  };
  const removeKey = () => {
    if (sel == null) return;
    setLayout((L) => L.filter((_, i) => i !== sel));
    setSel(null); markDirty();
  };

  // ---- profile actions ----
  const save = async () => {
    if (!currentId) return;
    try {
      const r = await (await fetch("/api/profiles/" + currentId, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      })).json();
      if (!r.ok) throw new Error(r.error || "save failed");
      setDirty(false);
      toast.success("บันทึกแล้ว — overlay จะรีโหลดเอง");
    } catch (e) { toast.error("บันทึกไม่สำเร็จ: " + (e as Error).message); }
  };
  const submitDialog = async () => {
    const name = nameInput.trim();
    if (!name) return;
    if (dialog === "new") {
      try {
        const r = await (await fetch("/api/profiles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, layout: DEFAULT_LAYOUT }),
        })).json();
        if (!r.ok) throw new Error(r.error);
        setProfiles((p) => [...p, r.profile]);
        await loadProfile(r.profile.id);
        toast.success('สร้าง profile "' + name + '"');
      } catch (e) { toast.error((e as Error).message); }
    } else if (dialog === "rename" && currentId) {
      try {
        await fetch("/api/profiles/" + currentId, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        setProfiles((p) => p.map((x) => (x.id === currentId ? { ...x, name } : x)));
        toast.success("เปลี่ยนชื่อแล้ว");
      } catch (e) { toast.error((e as Error).message); }
    }
    setDialog(null);
  };
  const removeProfile = async () => {
    if (!currentId || profiles.length <= 1) { toast.error("ต้องมีอย่างน้อย 1 profile"); return; }
    if (!confirm("ลบ profile นี้? URL จะใช้ไม่ได้อีก")) return;
    try {
      const r = await (await fetch("/api/profiles/" + currentId, { method: "DELETE" })).json();
      if (!r.ok) throw new Error(r.error);
      const rest = profiles.filter((p) => p.id !== currentId);
      setProfiles(rest);
      await loadProfile(rest[0].id);
      toast.success("ลบแล้ว");
    } catch (e) { toast.error((e as Error).message); }
  };

  const ext = layoutExtent(layout);
  const boxStyle = { "--cols": ext.cols, "--rows": ext.rows } as CSSProperties;
  const selKey = sel != null ? layout[sel] : null;

  return (
    <div className="space-y-4">
      {/* profile bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm tracking-wider text-muted-foreground">PROFILE</span>
        <select
          value={currentId ?? ""}
          onChange={(e) => loadProfile(e.target.value)}
          className="h-9 rounded-md border border-input bg-secondary/40 px-3 text-sm text-foreground outline-none focus:border-primary"
        >
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => { setNameInput("Profile " + (profiles.length + 1)); setDialog("new"); }}>
          <Plus className="h-4 w-4" /> ใหม่
        </Button>
        <Button variant="outline" size="sm" onClick={() => { const c = profiles.find((p) => p.id === currentId); setNameInput(c?.name ?? ""); setDialog("rename"); }}>เปลี่ยนชื่อ</Button>
        <Button variant="outline" size="sm" onClick={removeProfile} className="text-destructive">ลบ</Button>

        <div className="ml-auto flex items-center gap-2">
          <code className="max-w-[240px] truncate rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-xs text-primary">{overlayUrl || "—"}</code>
          <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(overlayUrl); toast.success("คัดลอก URL แล้ว"); }}><Copy className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => currentId && window.open(overlayUrl, "_blank")}><ExternalLink className="h-4 w-4" /></Button>
          <Button onClick={save} className="shadow-neon">
            <Save className="h-4 w-4" /> บันทึก{dirty ? " •" : ""}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* stage */}
        <Card className="relative overflow-auto border-border/70 bg-[repeating-conic-gradient(#12151c_0%_25%,#171b24_0%_50%)] bg-[length:26px_26px] p-6">
          <div className="mb-3">
            <Button variant="outline" size="sm" onClick={addKey}><Plus className="h-4 w-4" /> เพิ่มปุ่ม</Button>
          </div>
          <div className="grid place-items-center py-6">
            <div className={kb.kb} style={boxStyle}>
              {layout.map((k, i) => {
                const style = { "--x": k.x, "--y": k.y, "--w": k.w, "--h": k.h } as CSSProperties;
                return (
                  <div
                    key={i}
                    className={`${kb.key} ${kb.editable} ${sel === i ? kb.selected : ""} ${dragRef.current?.i === i ? kb.dragging : ""}`}
                    style={style}
                    onPointerDown={(e) => onKeyDown(i, e)}
                  >
                    <span className={kb.cap}>{k.label ?? ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">คลิกเลือกปุ่ม · ลากเพื่อย้าย (snap 0.25 · กด Alt ค้าง = ละเอียด)</p>
        </Card>

        {/* inspector */}
        <Card className="h-fit space-y-3 border-border/70 bg-card/70 p-4">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">แก้ไข</h2>
          {!selKey ? (
            <p className="text-sm text-muted-foreground">คลิกปุ่มในพรีวิวเพื่อแก้ไข หรือกด “เพิ่มปุ่ม”</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label>ป้าย (label)</Label>
                <Input value={selKey.label ?? ""} onChange={(e) => patch({ label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>ปุ่มจริง (keycode)</Label>
                <div className="flex gap-2">
                  <select
                    value={selKey.code ?? ""}
                    onChange={(e) => { const code = Number(e.target.value); patch({ code, label: suggestLabel(code) }); }}
                    className="h-9 flex-1 rounded-md border border-input bg-secondary/40 px-2 text-sm outline-none focus:border-primary"
                  >
                    {KEY_OPTIONS.map((o) => <option key={o.name} value={o.code}>{o.name} ({o.code})</option>)}
                    {selKey.code != null && CODE_TO_NAME[selKey.code] === undefined && (
                      <option value={selKey.code}>custom ({selKey.code})</option>
                    )}
                  </select>
                  <Button variant={recording ? "default" : "outline"} size="sm" onClick={() => setRecording((r) => !r)}>
                    <Radio className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{recording ? "กำลังรอ… กดปุ่มจริง (ต้องมีสิทธิ์ Accessibility)" : `code: ${selKey.code}`}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["w", "h", "x", "y"] as const).map((f) => (
                  <div key={f} className="space-y-1">
                    <Label className="uppercase">{f}</Label>
                    <Input type="number" step="0.25" value={selKey[f]} onChange={(e) => patch({ [f]: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={removeKey} className="w-full text-destructive"><Trash2 className="h-4 w-4" /> ลบปุ่มนี้</Button>
            </>
          )}
        </Card>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog === "new" ? "สร้าง profile ใหม่" : "เปลี่ยนชื่อ profile"}</DialogTitle></DialogHeader>
          <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitDialog()} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>ยกเลิก</Button>
            <Button onClick={submitDialog}>ตกลง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
