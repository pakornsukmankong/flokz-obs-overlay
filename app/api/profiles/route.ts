import { NextResponse } from "next/server";
import { readStore, writeStore, genId } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = readStore();
  return NextResponse.json({ profiles: store.profiles.map((p) => ({ id: p.id, name: p.name })) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const store = readStore();
  const name = (body.name || "Untitled").toString().slice(0, 60).trim() || "Untitled";
  const profile = { id: genId(), name, layout: Array.isArray(body.layout) ? body.layout : [] };
  store.profiles.push(profile);
  writeStore(store);
  return NextResponse.json({ ok: true, profile: { id: profile.id, name: profile.name } });
}
