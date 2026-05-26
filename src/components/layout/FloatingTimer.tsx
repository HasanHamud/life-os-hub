import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Play, Pause, X, Timer as TimerIcon, Watch } from "lucide-react";
import { usePomodoro, useStopwatch } from "@/core/timer-store";
import { useStore } from "@/core/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function fmtMS(totalSec: number) {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.max(0, totalSec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtHMS(totalMs: number) {
  const total = Math.floor(totalMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function FloatingTimer() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { settings, addSession, tasks } = useStore();
  const pomo = usePomodoro();
  const sw = useStopwatch();
  const [, force] = useState(0);

  // tick every second
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // pomodoro completion detection
  useEffect(() => {
    if (!pomo.running || !pomo.endsAt) return;
    if (Date.now() >= pomo.endsAt) {
      const session = pomo.tickComplete(
        settings.pomodoroFocus, settings.pomodoroBreak, settings.pomodoroLongBreak, settings.pomodoroLongEvery,
      );
      if (session.duration > 5) {
        void addSession({
          taskId: session.taskId,
          startTime: session.startedAt,
          endTime: session.endedAt,
          duration: session.duration,
          type: session.mode,
        });
      }
      toast.success(`${session.mode === "focus" ? "Focus" : "Break"} complete`);
      if (settings.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(`${session.mode === "focus" ? "Focus" : "Break"} complete`); } catch { /* ignore */ }
      }
    }
  });

  const pomoSecLeft = pomo.running && pomo.endsAt
    ? Math.max(0, Math.round((pomo.endsAt - Date.now()) / 1000))
    : pomo.remaining;

  const showPomo = pomo.running || (pomo.endsAt !== null) || (pomo.remaining !== pomo.totalSeconds && pomo.remaining > 0);
  const showSw = sw.running || sw.accumulatedMs > 0;

  // Hide widgets when on their own pages
  const onPomoPage = path.startsWith("/pomodoro");
  const onSwPage = path.startsWith("/stopwatch");

  if ((!showPomo || onPomoPage) && (!showSw || onSwPage)) return null;

  const pomoTask = pomo.taskId ? tasks.find((t) => t.id === pomo.taskId) : undefined;
  const swTask = sw.taskId ? tasks.find((t) => t.id === sw.taskId) : undefined;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {showPomo && !onPomoPage && (
        <div className="pointer-events-auto rounded-xl border bg-card/95 backdrop-blur shadow-lg px-3 py-2 flex items-center gap-3 min-w-[220px]">
          <div className={cn(
            "h-8 w-8 rounded-md grid place-items-center",
            pomo.mode === "focus" ? "bg-primary/15 text-primary" : "bg-success/15 text-success",
          )}>
            <TimerIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
              {pomo.mode === "focus" ? "Focus" : "Break"}
            </div>
            <Link to="/pomodoro" className="block text-lg font-display tabular-nums leading-tight hover:underline">
              {fmtMS(pomoSecLeft)}
            </Link>
            {pomoTask && <div className="text-[10px] text-muted-foreground truncate">{pomoTask.title}</div>}
          </div>
          <div className="flex items-center gap-1">
            {pomo.running ? (
              <button onClick={() => pomo.pause()} className="p-1.5 rounded hover:bg-muted" aria-label="Pause">
                <Pause className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => pomo.start(settings.pomodoroFocus, settings.pomodoroBreak)} className="p-1.5 rounded hover:bg-muted" aria-label="Start">
                <Play className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => pomo.reset(settings.pomodoroFocus, settings.pomodoroBreak)} className="p-1.5 rounded hover:bg-muted" aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {showSw && !onSwPage && (
        <div className="pointer-events-auto rounded-xl border bg-card/95 backdrop-blur shadow-lg px-3 py-2 flex items-center gap-3 min-w-[220px]">
          <div className="h-8 w-8 rounded-md grid place-items-center bg-warning/15 text-warning">
            <Watch className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Stopwatch</div>
            <Link to="/stopwatch" className="block text-lg font-display tabular-nums leading-tight hover:underline">
              {fmtHMS(sw.getElapsedMs())}
            </Link>
            {(swTask || sw.label) && (
              <div className="text-[10px] text-muted-foreground truncate">{swTask?.title ?? sw.label}</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {sw.running ? (
              <button onClick={() => sw.pause()} className="p-1.5 rounded hover:bg-muted" aria-label="Pause">
                <Pause className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => sw.start()} className="p-1.5 rounded hover:bg-muted" aria-label="Start">
                <Play className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => sw.reset()} className="p-1.5 rounded hover:bg-muted" aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}