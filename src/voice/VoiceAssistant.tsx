import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Mic, MicOff, X, Volume2, VolumeX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { listenOnce, isVoiceInputSupported, type VoiceInputError } from "@/voice/voiceInput";
import { speak, stopSpeaking, isVoiceOutputSupported } from "@/voice/voiceOutput";
import { resolveIntent } from "@/voice/intentResolver";
import { handleIntent } from "@/voice/actions";

type Status = "idle" | "listening" | "thinking" | "responding" | "error";

export function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [muted, setMuted] = useState(false);
  const handleRef = useRef<ReturnType<typeof listenOnce> | null>(null);
  const navigate = useNavigate();

  const supported = isVoiceInputSupported();

  useEffect(() => () => {
    handleRef.current?.abort();
    stopSpeaking();
  }, []);

  function reset() {
    setPartial("");
    setTranscript("");
    setResponse("");
    setStatus("idle");
  }

  async function startListening() {
    if (!supported) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }
    reset();
    setStatus("listening");
    setOpen(true);

    const handle = listenOnce({
      onPartial: (t) => setPartial(t),
    });
    handleRef.current = handle;

    try {
      const text = await handle.promise;
      setPartial("");
      setTranscript(text);
      setStatus("thinking");

      const intent = await resolveIntent(text);
      const result = await handleIntent(intent);

      setResponse(result.message);
      setStatus("responding");
      if (!muted && isVoiceOutputSupported()) speak(result.message);

      if (result.navigateTo) {
        toast.success(result.message);
        setTimeout(() => navigate({ to: result.navigateTo as any }), 350);
      }
    } catch (err: any) {
      const code = err?.code as VoiceInputError | undefined;
      const msg =
        code === "no-speech" ? "I didn't hear anything. Try again." :
        code === "not-allowed" ? "Microphone access denied." :
        code === "unsupported" ? "Voice input isn't supported here." :
        code === "aborted" ? "" :
        "Something went wrong. Try again.";
      if (msg) {
        setResponse(msg);
        setStatus("error");
        if (!muted) speak(msg);
      } else {
        setStatus("idle");
      }
    } finally {
      handleRef.current = null;
    }
  }

  function stopListening() {
    handleRef.current?.abort();
    handleRef.current = null;
    stopSpeaking();
    setStatus("idle");
  }

  return (
    <>
      {/* Floating mic button */}
      <button
        onClick={() => (status === "listening" ? stopListening() : startListening())}
        className={cn(
          "fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full shadow-lg grid place-items-center transition-all",
          "border bg-background text-foreground hover:scale-105",
          status === "listening" && "bg-destructive text-destructive-foreground border-destructive animate-pulse",
        )}
        title={supported ? "Voice assistant" : "Voice not supported"}
        aria-label="Voice assistant"
      >
        {status === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-card shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-2 w-2 rounded-full",
                status === "listening" && "bg-destructive animate-pulse",
                status === "thinking" && "bg-warning animate-pulse",
                status === "responding" && "bg-success",
                status === "error" && "bg-destructive",
                status === "idle" && "bg-muted-foreground",
              )} />
              <span className="text-sm font-medium capitalize">
                {status === "thinking" ? "Thinking…" : status === "listening" ? "Listening…" : status}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setMuted((m) => !m);
                  if (!muted) stopSpeaking();
                }}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => { stopListening(); setOpen(false); reset(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(partial || transcript) && (
            <div className="mb-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">You said</div>
              <div className="text-sm">{transcript || <span className="text-muted-foreground italic">{partial}…</span>}</div>
            </div>
          )}

          {status === "thinking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Working on it…
            </div>
          )}

          {response && (
            <div className="mt-2 rounded-md bg-muted p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Assistant</div>
              <div className="text-sm">{response}</div>
            </div>
          )}

          {status === "idle" && !response && (
            <div className="text-xs text-muted-foreground">
              Try: <em>"tasks today"</em>, <em>"what's next"</em>, <em>"add task buy milk"</em>, <em>"start pomodoro"</em>, <em>"balance"</em>.
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button size="sm" className="flex-1" onClick={startListening} disabled={status === "listening" || status === "thinking"}>
              <Mic className="h-3.5 w-3.5" /> {status === "listening" ? "Listening" : "Speak"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
