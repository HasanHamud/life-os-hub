// Layer 1: Input — speech to text via Web Speech API.
// Pure browser, no network. Returns recognized text or rejects with a code.

export type VoiceInputError = "unsupported" | "no-speech" | "not-allowed" | "aborted" | "error";

type SR = any;

function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function isVoiceInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export interface ListenOptions {
  lang?: string;
  onPartial?: (text: string) => void;
}

export interface ListenHandle {
  promise: Promise<string>;
  abort: () => void;
}

export function listenOnce(opts: ListenOptions = {}): ListenHandle {
  const recognition = getRecognition();
  if (!recognition) {
    return {
      promise: Promise.reject<string>(Object.assign(new Error("Speech recognition not supported"), { code: "unsupported" as VoiceInputError })),
      abort: () => {},
    };
  }

  recognition.lang = opts.lang || "en-US";
  recognition.interimResults = Boolean(opts.onPartial);
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let settled = false;

  const promise = new Promise<string>((resolve, reject) => {
    recognition.onresult = (event: any) => {
      let finalText = "";
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += transcript;
        else partial += transcript;
      }
      if (partial && opts.onPartial) opts.onPartial(partial.trim());
      if (finalText.trim()) {
        settled = true;
        resolve(finalText.trim());
        try { recognition.stop(); } catch {}
      }
    };

    recognition.onerror = (event: any) => {
      if (settled) return;
      settled = true;
      const code: VoiceInputError =
        event?.error === "no-speech" ? "no-speech" :
        event?.error === "not-allowed" || event?.error === "service-not-allowed" ? "not-allowed" :
        event?.error === "aborted" ? "aborted" : "error";
      reject(Object.assign(new Error(event?.error || "Speech error"), { code }));
    };

    recognition.onend = () => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error("No speech detected"), { code: "no-speech" as VoiceInputError }));
    };

    try {
      recognition.start();
    } catch (err: any) {
      settled = true;
      reject(Object.assign(new Error(err?.message || "Could not start"), { code: "error" as VoiceInputError }));
    }
  });

  return {
    promise,
    abort: () => {
      try { recognition.abort(); } catch {}
    },
  };
}