import { NextResponse } from "next/server";
import { readStore, writeStore, findProfile } from "@/lib/store";
import { reloadProfile } from "@/lib/ws-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const store = readStore();
  const p = findProfile(store, id);
  if (!p) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ id: p.id, name: p.name, layout: p.layout });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const store = readStore();
  const p = findProfile(store, id);
  if (!p) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (typeof body.name === "string") p.name = body.name.slice(0, 60).trim() || p.name;
  if (Array.isArray(body.layout)) p.layout = body.layout;
  writeStore(store);
  reloadProfile(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const store = readStore();
  if (store.profiles.length <= 1)
    return NextResponse.json({ ok: false, error: "ต้องมีอย่างน้อย 1 profile" }, { status: 400 });
  const before = store.profiles.length;
  store.profiles = store.profiles.filter((p) => p.id !== id);
  if (store.profiles.length === before)
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  writeStore(store);
  return NextResponse.json({ ok: true });
}
