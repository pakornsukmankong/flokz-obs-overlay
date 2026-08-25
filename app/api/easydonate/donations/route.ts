import { NextResponse } from "next/server";
import { fetchDonations, getConfig } from "@/lib/easydonate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// overlay poll เอาโดเนทล่าสุด (จริง + ทดสอบ) + ค่าตั้ง (duration/minAmount)
export async function GET() {
  const [donations, cfg] = await Promise.all([fetchDonations(), getConfig()]);
  return NextResponse.json({ donations, minAmount: cfg.minAmount, durationMs: cfg.durationMs, tts: cfg.tts, voiceURI: cfg.voiceURI, rate: cfg.rate });
}
