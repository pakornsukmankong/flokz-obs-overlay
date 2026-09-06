import { NextResponse } from "next/server";
import crypto from "crypto";
import { kvGet, kvSet } from "@/lib/kv";
import { jsonEtag } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TalkConfig = { talking: string | null; idle: string | null; threshold: number; hold: number };
const DEFAULTS: TalkConfig = { talking: null, idle: null, threshold: 0.05, hold: 180 };
const KEY = "talk";

function version(cfg: TalkConfig): string {
  return crypto.createHash("sha1").update(JSON.stringify(cfg)).digest("hex").slice(0, 12);
}

// overlay poll ทุก 3s ตลอดที่เปิด OBS — เดิมส่งรูป avatar (base64) กลับทุก poll ทั้งที่รูป
// แทบไม่เคยเปลี่ยน กิน bandwidth มหาศาล (พึ่ง ETag/304 ของ browser cache อย่างเดียวไม่พอ เพราะ
// เบราว์เซอร์ในตัว OBS/CEF บางเวอร์ชันไม่ honor conditional cache แบบเดียวกับเบราว์เซอร์เต็มรูปแบบ)
// เลย "การันตี" ด้วย application logic แทน: ?meta=1 ตอบแค่ version+ค่าตัวเลข (ไม่มีรูป) ให้ overlay
// poll ถี่ๆ ได้ถูกๆ แล้วดึงรูปเต็ม (endpoint ปกติ) เฉพาะตอน version เปลี่ยนจริงเท่านั้น
export async function GET(req: Request) {
  const cfg = { ...DEFAULTS, ...((await kvGet<TalkConfig>(KEY)) ?? {}) };
  const url = new URL(req.url);
  if (url.searchParams.get("meta") === "1") {
    return jsonEtag(req, {
      version: version(cfg),
      threshold: cfg.threshold,
      hold: cfg.hold,
      hasIdle: !!cfg.idle,
      hasTalking: !!cfg.talking,
    });
  }
  return jsonEtag(req, { ...cfg, version: version(cfg) });
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
