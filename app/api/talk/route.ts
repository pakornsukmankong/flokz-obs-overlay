import { NextResponse } from "next/server";
import { readTalk, writeTalk } from "@/lib/talk-store";
import { talkReload } from "@/lib/ws-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readTalk());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  const cur = readTalk();
  const cfg = {
    talking: typeof body.talking === "string" ? body.talking : cur.talking,
    idle: typeof body.idle === "string" ? body.idle : cur.idle,
    threshold: Number.isFinite(body.threshold) ? body.threshold : cur.threshold,
    hold: Number.isFinite(body.hold) ? body.hold : cur.hold,
  };
  writeTalk(cfg);
  talkReload();
  return NextResponse.json({ ok: true });
}
