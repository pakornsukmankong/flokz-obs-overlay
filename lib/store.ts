/**
 * store.ts — เก็บ profiles ของ overlay คีย์บอร์ด (config/profiles.json)
 * ทำงานฝั่ง server (route handlers) เท่านั้น
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CONFIG_DIR = path.join(process.cwd(), "config");
const PROFILES_FILE = path.join(CONFIG_DIR, "profiles.json");

export type KeyDef = {
  code?: number;
  label?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  spacer?: number;
};
export type Profile = { id: string; name: string; layout: KeyDef[] };
export type Store = { version: number; profiles: Profile[] };

export function genId(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function writeStore(store: Store) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function readStore(): Store {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"));
    if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) return parsed;
  } catch {
    /* seed ใหม่ */
  }
  const store: Store = { version: 1, profiles: [{ id: genId(), name: "Default", layout: [] }] };
  writeStore(store); // persist ทันที ให้ id/URL คงที่
  return store;
}

export function findProfile(store: Store, id: string): Profile | null {
  return store.profiles.find((p) => p.id === id) ?? null;
}
