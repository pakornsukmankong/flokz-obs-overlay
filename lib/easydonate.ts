/**
 * easydonate.ts — ดึงโดเนทจาก EasyDonate (read:donations) แบบ server-side
 *   - API key เก็บใน KV (ไม่โผล่ client)
 *   - cache 4s กัน rate limit 60/นาที
 *   - รวม "โดเนททดสอบ" (จากปุ่มทดสอบ) เพื่อ preview overlay ได้โดยไม่ต้องมีโดเนทจริง
 */
import { kvGet, kvSet } from "@/lib/kv";

export type Donation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  message: string;
  createdAt: number; // epoch ms
};

export type DonateConfig = {
  apiKey: string | null;
  minAmount: number;
  durationMs: number;
  tts: boolean;
  voiceURI: string | null;
  rate: number;
};

export const K = { config: "donate:config", cache: "donate:cache", test: "donate:test" };
export const DEFAULT_CONFIG: DonateConfig = {
  apiKey: null, minAmount: 0, durationMs: 6000, tts: true, voiceURI: null, rate: 1,
};

const API_URL = "https://api.easydonate.app/api/v1/donations?limit=20";

export async function getConfig(): Promise<DonateConfig> {
  return { ...DEFAULT_CONFIG, ...((await kvGet<Partial<DonateConfig>>(K.config)) ?? {}) };
}
export async function saveConfig(cfg: DonateConfig): Promise<void> {
  await kvSet(K.config, cfg);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(d: any): Donation | null {
  if (!d || typeof d !== "object") return null;
  const id = String(d.id ?? d.referenceNo ?? d.reference_no ?? "");
  if (!id) return null;
  const created = d.createdAt ?? d.created_at;
  return {
    id,
    name: String(d.donatorName ?? d.donator_name ?? d.name ?? "Anonymous").slice(0, 50),
    amount: Number(d.amount ?? 0) || 0,
    currency: String(d.currency ?? "THB"),
    message: String(d.message ?? ""),
    createdAt: created ? Date.parse(created) || Date.now() : Date.now(),
  };
}

async function fetchReal(apiKey: string): Promise<Donation[]> {
  const cache = await kvGet<{ at: number; items: Donation[] }>(K.cache);
  if (cache && Date.now() - cache.at < 4000) return cache.items;
  try {
    const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
    if (!res.ok) return cache?.items ?? [];
    const json = await res.json();
    const raw =
      (Array.isArray(json?.data) && json.data) ||
      json?.data?.donations || json?.data?.items || json?.donations || json?.items || [];
    const items = (raw as unknown[]).map(normalize).filter((x): x is Donation => !!x);
    await kvSet(K.cache, { at: Date.now(), items }, 60);
    return items;
  } catch {
    return cache?.items ?? [];
  }
}

/** โดเนทล่าสุด (จริง + ทดสอบ) เรียงใหม่สุดก่อน */
export async function fetchDonations(): Promise<Donation[]> {
  const cfg = await getConfig();
  const real = cfg.apiKey ? await fetchReal(cfg.apiKey) : [];
  const test = (await kvGet<Donation[]>(K.test)) ?? [];
  return [...real, ...test].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
}

export async function addTestDonation(input: Partial<Donation>): Promise<void> {
  const test = (await kvGet<Donation[]>(K.test)) ?? [];
  const d: Donation = {
    id: "test_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name: (input.name || "ผู้ทดสอบใจดี").slice(0, 50),
    amount: Number(input.amount) || 99,
    currency: "THB",
    message: input.message ?? "ทดสอบ alert 🎉",
    createdAt: Date.now(),
  };
  await kvSet(K.test, [...test, d].slice(-10), 300); // เก็บ 5 นาที
}
