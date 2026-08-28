import { NextResponse } from "next/server";
import { addTestDonation } from "@/lib/easydonate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ปุ่ม "ทดสอบ alert" — ยัดโดเนทปลอมเข้า queue ให้ overlay เล่นอนิเมชั่น (เทสต์โดยไม่ต้องมีโดเนทจริง)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    await addTestDonation({ name: body.name, amount: body.amount, message: body.message });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
