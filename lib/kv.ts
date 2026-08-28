/**
 * kv.ts — เก็บข้อมูลแบบ 2 โหมด:
 *   - บน Vercel (มี env KV_REST_API_URL): ใช้ Vercel KV (Upstash Redis)
 *   - ตอน dev ในเครื่อง (ไม่มี env): เขียนไฟล์ JSON ใน ./config (zero-setup)
 * ใช้ฝั่ง server (route handlers) เท่านั้น
 */
import fs from "fs";
import path from "path";

const useKV = !!process.env.KV_REST_API_URL;
const onVercel = !!process.env.VERCEL; // ตั้งค่าอัตโนมัติทุก deployment บน Vercel
const DIR = path.join(process.cwd(), "config");

function filePath(key: string) {
  return path.join(DIR, key.replace(/[:/\\]/g, "_") + ".json");
}

// โหลด @vercel/kv แบบ dynamic เฉพาะตอนใช้ KV (local dev จะไม่แตะ)
type KvClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
};
let client: KvClient | null = null;
async function kvClient(): Promise<KvClient> {
  if (!client) client = (await import("@vercel/kv")).kv as unknown as KvClient;
  return client;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (useKV) {
    const c = await kvClient();
    return (await c.get<T>(key)) ?? null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath(key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  if (useKV) {
    const c = await kvClient();
    await c.set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
    return;
  }
  // บน Vercel ที่ยังไม่เชื่อม KV: filesystem เป็น read-only เขียนไม่ได้จริง — โยน error
  // ที่อ่านรู้เรื่องแทนที่จะปล่อยให้ fs พังแบบ error ดิบๆ (route จะจับไปโชว์ผู้ใช้)
  if (onVercel) {
    throw new Error(
      "ยังไม่ได้เชื่อม Storage บน Vercel — ไปที่ Project → Storage → Create Database (เลือก Upstash/KV) → Connect แล้ว Redeploy"
    );
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(filePath(key), JSON.stringify(value, null, 2), "utf8");
}
