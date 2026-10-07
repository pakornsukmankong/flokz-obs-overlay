import { NextResponse } from "next/server";
import crypto from "crypto";
import { kvGet, kvSet } from "@/lib/kv";
import { jsonEtag } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TalkConfig = { talking: string | null; idle: string | null; threshold: number; hold: number };
const DEFAULTS: TalkConfig = { talking: null, idle: null, threshold: 0.05, hold: 180 };
const KEY = "talk";

type TalkMeta = { version: string; threshold: number; hold: number; hasIdle: boolean; hasTalking: boolean };
const META_KEY = "talk:meta";
const META_MAX_AGE = 10000;

function toMeta(cfg: TalkConfig): TalkMeta {
  return {
    version: crypto.createHash("sha1").update(JSON.stringify(cfg)).digest("hex").slice(0, 12),
    threshold: cfg.threshold,
    hold: cfg.hold,
    hasIdle: !!cfg.idle,
    hasTalking: !!cfg.talking,
  };
}

// overlay poll ?meta=1 ตลอดที่เปิด OBS — meta เก็บแยก key เล็กๆ (ไม่มีรูป) เพื่อไม่ต้องดึงรูป avatar
// (base64 หลายร้อย KB) ออกจาก KV ทุก poll; รูปเต็ม (endpoint ปกติ) ถูกอ่านเฉพาะตอนโหลด/ตอน version เปลี่ยน
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("meta") === "1") {
    let meta = await kvGet<TalkMeta>(META_KEY, META_MAX_AGE);
    if (!meta) {
      // ข้อมูลเก่าที่บันทึกก่อนมี talk:meta — สร้างจากตัวเต็มครั้งเดียว
      meta = toMeta({ ...DEFAULTS, ...((await kvGet<TalkConfig>(KEY)) ?? {}) });
      await kvSet(META_KEY, meta).catch(() => {});
    }
    return jsonEtag(req, meta);
  }
  const cfg = { ...DEFAULTS, ...((await kvGet<TalkConfig>(KEY)) ?? {}) };
  return jsonEtag(req, { ...cfg, version: toMeta(cfg).version });
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
    await kvSet(META_KEY, toMeta(cfg));
    return NextResponse.json({ ok: true });
  } catch (e) {
    // กัน response ว่างเปล่า (ทำให้ client .json() พังแบบงงๆ) — ส่ง error ที่อ่านรู้เรื่องกลับไปแทน
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
