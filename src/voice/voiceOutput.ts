// Layer 4: Output — text to speech via SpeechSynthesis API.
// Pure browser, no network.

export function isVoiceOutputSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (!text || !isVoiceOutputSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang || "en-US";
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.volume = opts.volume ?? 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  if (!isVoiceOutputSupported()) return;
  try { window.speechSynthesis.cancel(); } catch {}
}
