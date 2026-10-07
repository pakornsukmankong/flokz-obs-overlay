/**
 * easydonate.ts — ดึงโดเนทจาก EasyDonate (read:donations) แบบ server-side
 *   - API key เก็บใน KV (ไม่โผล่ client)
 *   - cache 4s (ในหน่วยความจำ) กัน rate limit 60/นาที — ไม่เขียนลง KV เพื่อประหยัด command
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

export const K = { config: "donate:config", test: "donate:test" };
const CONFIG_MAX_AGE = 30000, TEST_MAX_AGE = 5000; // ยอมใช้ค่าใน memory ของ instance นานเท่านี้ (ms)
export const DEFAULT_CONFIG: DonateConfig = {
  apiKey: null, minAmount: 0, durationMs: 6000, tts: true, voiceURI: null, rate: 1,
};

// base URL ของ EasyDonate API — override ได้ด้วย env ถ้า host/path จริงไม่ตรง
export const API_BASE = process.env.EASYDONATE_API_BASE || "https://api.easydonate.app/api/v1";
const API_URL = `${API_BASE}/donations?limit=20`;

export async function getConfig(): Promise<DonateConfig> {
  return { ...DEFAULT_CONFIG, ...((await kvGet<Partial<DonateConfig>>(K.config, CONFIG_MAX_AGE)) ?? {}) };
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
    name: String(d.donatorName ?? d.donator_name ?? d.name ?? "Anonymous").trim() || "Anonymous",
    amount: Number(d.amount ?? 0) || 0,
    currency: String(d.currency ?? "THB"),
    message: String(d.donateMessage ?? d.message ?? ""),
    createdAt: created ? Date.parse(created) || Date.now() : Date.now(),
  };
}

/** แปลง response ของ EasyDonate GET /donations → รายการโดเนท (เอาเฉพาะ SUCCESS) */
export function parseDonationsResponse(json: unknown): Donation[] {
  const j = json as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const list: unknown[] =
    j?.data?.histories || // ← รูปจริงของ EasyDonate
    (Array.isArray(j?.data) && j.data) ||
    j?.data?.donations || j?.data?.items || j?.donations || j?.items || [];
  return (list as Record<string, unknown>[])
    .filter((d) => d && (!("status" in d) || d.status === "SUCCESS"))
    .map(normalize)
    .filter((x): x is Donation => !!x);
}

let cache: { at: number; key: string; items: Donation[] } | null = null;

async function fetchReal(apiKey: string): Promise<Donation[]> {
  if (cache && cache.key !== apiKey) cache = null;
  if (cache && Date.now() - cache.at < 4000) return cache.items;
  try {
    const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
    if (!res.ok) return cache?.items ?? [];
    const items = parseDonationsResponse(await res.json());
    cache = { at: Date.now(), key: apiKey, items };
    return items;
  } catch {
    return cache?.items ?? [];
  }
}

/** โดเนทล่าสุด (จริง + ทดสอบ) เรียงใหม่สุดก่อน */
export async function fetchDonations(): Promise<Donation[]> {
  const cfg = await getConfig();
  const real = cfg.apiKey ? await fetchReal(cfg.apiKey) : [];
  const test = (await kvGet<Donation[]>(K.test, TEST_MAX_AGE)) ?? [];
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
