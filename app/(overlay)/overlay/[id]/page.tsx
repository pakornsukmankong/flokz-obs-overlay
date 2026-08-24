"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { KeyboardView } from "@/components/keyboard-view";
import { KeyDef, DEFAULT_LAYOUT, toFreeLayout } from "@/lib/keyboard";

export default function KeyboardOverlayPage() {
  const params = useParams();
  const id = String(params.id);
  const [layout, setLayout] = useState<KeyDef[] | null>(null);
  const [pressed, setPressed] = useState<Set<number>>(new Set());

  // โหลด layout ของ profile
  useEffect(() => {
    let alive = true;
    (async () => {
      let l: KeyDef[] = DEFAULT_LAYOUT;
      try {
        const res = await fetch("/api/profiles/" + id, { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          if (Array.isArray(j.layout) && j.layout.length) l = toFreeLayout(j.layout);
        }
      } catch {
        /* ใช้ default */
      }
      if (alive) setLayout(l);
    })();
    return () => { alive = false; };
  }, [id]);

  // WebSocket: hello + down/up + reload
  useEffect(() => {
    let ws: WebSocket | null = null;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (stop) return;
      ws = new WebSocket(`ws://${location.host}`);
      ws.onopen = () => ws?.send(JSON.stringify({ type: "hello", profile: id }));
      ws.onmessage = (ev) => {
        let d: { type?: string; keycode?: number };
        try { d = JSON.parse(ev.data); } catch { return; }
        if (d.type === "down" && d.keycode != null)
          setPressed((p) => { const n = new Set(p); n.add(d.keycode!); return n; });
        else if (d.type === "up" && d.keycode != null)
          setPressed((p) => { const n = new Set(p); n.delete(d.keycode!); return n; });
        else if (d.type === "reload") location.reload();
      };
      ws.onclose = () => { setPressed(new Set()); timer = setTimeout(connect, 1000); };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => { stop = true; clearTimeout(timer); ws?.close(); };
  }, [id]);

  if (!layout) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 24,
        background: "transparent",
      }}
    >
      <KeyboardView layout={layout} pressed={pressed} />
    </div>
  );
}
