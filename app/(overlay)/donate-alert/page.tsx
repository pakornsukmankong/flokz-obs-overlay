"use client";

import { useEffect, useRef, useState } from "react";
import { DonationAlertCard } from "@/components/donation-alert";
import { speakDonation } from "@/lib/tts";

type Donation = { id: string; name: string; amount: number; currency: string; message: string; createdAt: number };
const SEEN_KEY = "flokz.donate.seen";

export default function DonateAlertPage() {
  const [current, setCurrent] = useState<Donation | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<Donation[]>([]);
  const showingRef = useRef(false);
  const cfgRef = useRef<{ durationMs: number; minAmount: number; tts: boolean; voiceURI: string | null; rate: number }>({ durationMs: 6000, minAmount: 0, tts: true, voiceURI: null, rate: 1 });

  const persistSeen = () => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenRef.current].slice(-500))); } catch {}
  };

  const pump = () => {
    if (showingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    showingRef.current = true;
    setCurrent(next);
    speakDonation(next, { enabled: cfgRef.current.tts, voiceURI: cfgRef.current.voiceURI, rate: cfgRef.current.rate });
    setTimeout(() => {
      setCurrent(null);
      showingRef.current = false;
      setTimeout(pump, 400); // เว้นจังหวะก่อนตัวถัดไป
    }, cfgRef.current.durationMs);
  };

  useEffect(() => {
    try { seenRef.current = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch {}
    let alive = true, first = true;
    const poll = async () => {
      try {
        const j = await (await fetch("/api/easydonate/donations", { cache: "no-store" })).json();
        if (!alive) return;
        cfgRef.current = { durationMs: j.durationMs || 6000, minAmount: j.minAmount || 0, tts: j.tts !== false, voiceURI: j.voiceURI ?? null, rate: j.rate || 1 };
        const ordered: Donation[] = [...(j.donations || [])].sort((a, b) => a.createdAt - b.createdAt);
        for (const d of ordered) {
          if (seenRef.current.has(d.id)) continue;
          seenRef.current.add(d.id);
          if (!first && d.amount >= cfgRef.current.minAmount) queueRef.current.push(d);
        }
        persistSeen();
        first = false;
        pump();
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "transparent", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" }}>
      {current && <DonationAlertCard donation={current} />}
    </div>
  );
}
