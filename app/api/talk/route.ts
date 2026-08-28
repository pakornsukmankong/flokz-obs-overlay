import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TalkConfig = { talking: string | null; idle: string | null; threshold: number; hold: number };
const DEFAULTS: TalkConfig = { talking: null, idle: null, threshold: 0.05, hold: 180 };
const KEY = "talk";

export async function GET() {
  const cfg = (await kvGet<TalkConfig>(KEY)) ?? DEFAULTS;
  return NextResponse.json({ ...DEFAULTS, ...cfg });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  try {
    const cur = (await kvGet<TalkConfig>(KEY)) ?? DEFAULTS;
    const cfg: TalkConfig = {
      talking: typeof body.talking === "string" ? body.talking : cur.talking,
      idle: typeof body.idle === "string" ? body.idle : cur.idle,
      threshold: Number.isFinite(body.threshold) ? body.threshold : cur.threshold,
      hold: Number.isFinite(body.hold) ? body.hold : cur.hold,
    };
    await kvSet(KEY, cfg);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // กัน response ว่างเปล่า (ทำให้ client .json() พังแบบงงๆ) — ส่ง error ที่อ่านรู้เรื่องกลับไปแทน
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
