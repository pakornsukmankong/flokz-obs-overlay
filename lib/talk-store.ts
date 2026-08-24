/**
 * talk-store.ts — config ของ talk overlay (config/talk.json)
 */
import fs from "fs";
import path from "path";

const CONFIG_DIR = path.join(process.cwd(), "config");
const TALK_FILE = path.join(CONFIG_DIR, "talk.json");

export type TalkConfig = {
  talking: string | null;
  idle: string | null;
  threshold: number;
  hold: number;
};

const DEFAULTS: TalkConfig = { talking: null, idle: null, threshold: 0.05, hold: 180 };

export function readTalk(): TalkConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(TALK_FILE, "utf8"));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeTalk(cfg: TalkConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TALK_FILE, JSON.stringify(cfg, null, 2), "utf8");
}
