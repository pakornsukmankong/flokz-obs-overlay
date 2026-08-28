import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GrindState = { count: number; lastAt: number | null; at: number };
const TTL = 86400; // เก็บ 1 วัน

function key(token: string) { return `grind:${token}`; }
function valid(t: string | null): t is string { return !!t && /^[A-Za-z0-9_-]{1,64}$/.test(t); }

// overlay poll ค่า count ล่าสุดของ token
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!valid(token)) return NextResponse.json({ count: 0, lastAt: null, at: 0 });
  const s = (await kvGet<GrindState>(key(token))) ?? { count: 0, lastAt: null, at: 0 };
  return NextResponse.json(s);
}

// หน้า counter ส่ง count มาเก็บ
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !valid(body.token)) return NextResponse.json({ ok: false, error: "bad token" }, { status: 400 });
  try {
    const state: GrindState = {
      count: Number.isFinite(body.count) ? body.count : 0,
      lastAt: Number.isFinite(body.lastAt) ? body.lastAt : null,
      at: Date.now(),
    };
    await kvSet(key(body.token), state, TTL);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
