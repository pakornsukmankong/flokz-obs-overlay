/**
 * tts.ts — อ่านออกเสียงโดเนทด้วย SpeechSynthesis ของเบราว์เซอร์ (client-only)
 * เลือก voice ได้ (ตาม voiceURI) + ปรับความเร็ว; ถ้าไม่เจอ voice ที่เลือก fallback ไปเสียงไทย/ดีฟอลต์
 */
export type TtsOptions = { enabled: boolean; voiceURI?: string | null; rate?: number };

export function speak(text: string, opts: TtsOptions) {
  if (!opts.enabled || typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = opts.rate && opts.rate > 0 ? opts.rate : 1;
    const voices = window.speechSynthesis.getVoices();
    let voice = opts.voiceURI ? voices.find((v) => v.voiceURI === opts.voiceURI) : undefined;
    if (!voice) voice = voices.find((v) => /^th/i.test(v.lang));
    if (voice) u.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* บางสภาพแวดล้อม (เช่น OBS) อาจไม่มี voice — เงียบไว้ */
  }
}

export function speakDonation(
  d: { name: string; amount: number; message?: string },
  opts: TtsOptions
) {
  speak(`${d.name} โดเนท ${d.amount} บาท` + (d.message ? `. ${d.message}` : ""), opts);
}

/** subscribe รายการ voice (getVoices เป็น async — ต้องฟัง voiceschanged) คืน unsubscribe */
export function loadVoices(cb: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const emit = () => cb(window.speechSynthesis.getVoices());
  emit();
  window.speechSynthesis.addEventListener("voiceschanged", emit);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", emit);
}
