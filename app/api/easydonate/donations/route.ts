import { fetchDonations, getConfig } from "@/lib/easydonate";
import { jsonEtag } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// overlay poll เอาโดเนทล่าสุด (จริง + ทดสอบ) + ค่าตั้ง (duration/minAmount) ทุก 5s ตลอดที่เปิด OBS
export async function GET(req: Request) {
  const [donations, cfg] = await Promise.all([fetchDonations(), getConfig()]);
  return jsonEtag(req, { donations, minAmount: cfg.minAmount, durationMs: cfg.durationMs, tts: cfg.tts, voiceURI: cfg.voiceURI, rate: cfg.rate });
}
