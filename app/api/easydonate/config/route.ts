import { NextResponse } from "next/server";
import { getConfig, saveConfig, DEFAULT_CONFIG, type DonateConfig } from "@/lib/easydonate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ไม่ส่ง apiKey กลับ client — บอกแค่ว่าตั้งค่าแล้วหรือยัง
export async function GET() {
  const c = await getConfig();
  return NextResponse.json({ configured: !!c.apiKey, minAmount: c.minAmount, durationMs: c.durationMs, tts: c.tts, voiceURI: c.voiceURI, rate: c.rate });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  const cur = await getConfig();
  const cfg: DonateConfig = {
    apiKey:
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : body.apiKey === null
          ? null
          : cur.apiKey, // undefined = คงเดิม
    minAmount: Number.isFinite(body.minAmount) ? Math.max(0, body.minAmount) : cur.minAmount,
    durationMs: Number.isFinite(body.durationMs) ? Math.min(20000, Math.max(2000, body.durationMs)) : cur.durationMs,
    tts: typeof body.tts === "boolean" ? body.tts : cur.tts,
    voiceURI: typeof body.voiceURI === "string" ? body.voiceURI : body.voiceURI === null ? null : cur.voiceURI,
    rate: Number.isFinite(body.rate) ? Math.min(2, Math.max(0.5, body.rate)) : cur.rate,
  };
  await saveConfig(cfg);
  return NextResponse.json({ ok: true, configured: !!cfg.apiKey, minAmount: cfg.minAmount, durationMs: cfg.durationMs, defaults: DEFAULT_CONFIG });
}
