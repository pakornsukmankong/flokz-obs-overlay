import { NextResponse } from "next/server";
import { getConfig, API_BASE, fetchDonations } from "@/lib/easydonate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ตรวจว่าเชื่อม EasyDonate ได้ไหม + ชื่อ field ตรงไหม
 * เปิด /api/easydonate/debug (ต้องตั้ง API key ก่อน) → เห็น raw response จริง
 * ถ้า mapped ว่าง/เพี้ยน = ชื่อ field ไม่ตรง เอา raw ไปแก้ normalize() ใน lib/easydonate.ts
 */
export async function GET() {
  const cfg = await getConfig();
  if (!cfg.apiKey) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้ง API key — ไปที่ /donate-setup ก่อน" });
  }
  const url = `${API_BASE}/donations?limit=5`;
  let upstream: { status?: number; body?: unknown; error?: string } = {};
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, cache: "no-store" });
    const text = await res.text();
    let body: unknown = text.slice(0, 4000);
    try { body = JSON.parse(text); } catch {}
    upstream = { status: res.status, body };
  } catch (e) {
    upstream = { error: (e as Error).message };
  }
  const mapped = await fetchDonations(); // ผ่าน normalize แล้ว
  return NextResponse.json({ ok: true, url, upstream, mapped });
}
