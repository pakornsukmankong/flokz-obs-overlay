/**
 * scan.worker.ts — สแกนหาแบนเนอร์ทั้งเฟรมนอก main thread + clock timer
 * (module worker — โหลดผ่าน new Worker(new URL('./scan.worker.ts', import.meta.url)))
 */
import { buildTemplate, searchGray, type Template } from "@/lib/detector";

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (m: unknown) => void;
};

let tpl: Template | null = null;
let clock: ReturnType<typeof setInterval> | null = null;

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "clock") {
    if (clock) clearInterval(clock);
    clock = msg.ms > 0 ? setInterval(() => ctx.postMessage({ type: "tick" }), msg.ms) : null;
    return;
  }
  if (msg.type === "scan") {
    if (!tpl) tpl = buildTemplate();
    const found = searchGray(new Uint8Array(msg.gray), msg.sw, msg.sh, msg.cutoff, tpl);
    ctx.postMessage({ type: "scan", seq: msg.seq, found });
  }
};
