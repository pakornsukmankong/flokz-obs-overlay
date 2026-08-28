import { NextResponse } from "next/server";
import { fetchDonations } from "@/lib/easydonate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รวมยอดโดเนทต่อคน → จัดอันดับ (จากโดเนทที่ดึงได้ + โดเนททดสอบ)
export async function GET(req: Request) {
  const limit = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 10));
  const donations = await fetchDonations();
  const map = new Map<string, { name: string; total: number; count: number }>();
  for (const d of donations) {
    const key = (d.name || "Anonymous").trim().toLowerCase() || "anonymous";
    const cur = map.get(key) || { name: d.name || "Anonymous", total: 0, count: 0 };
    cur.total += d.amount || 0;
    cur.count += 1;
    map.set(key, cur);
  }
  const donors = [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
  return NextResponse.json({ donors });
}
