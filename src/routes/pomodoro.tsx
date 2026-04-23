import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { fmt, sessionsOnDay } from "@/core/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pomodoro")({
  head: () => ({ meta: [
    { title: "Pomodoro — Life OS" },
    { name: "description", content: "Focus timer with customizable work and break intervals." },
  ]}),
  component: PomodoroPage,
});

type Mode = "focus" | "break";

function PomodoroPage() {
  const { tasks, sessions, settings, addSession, updateSettings } = useStore();
  const [mode, setMode] = useState<Mode>("focus");
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<string>("none");
  const [secondsLeft, setSecondsLeft] = useState(settings.pomodoroFocus * 60);
  const [completedRounds, setCompletedRounds] = useState(0);
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Re-init when settings change
  useEffect(() => {
    if (!running) {
      setSecondsLeft((mode === "focus" ? settings.pomodoroFocus :
        (completedRounds > 0 && completedRounds % settings.pomodoroLongEvery === 0 ? settings.pomodoroLongBreak : settings.pomodoroBreak)) * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            void completeSession();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const completeSession = async () => {
    setRunning(false);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    const start = startRef.current ?? Date.now();
    const end = Date.now();
    const duration = Math.round((end - start) / 1000);
    if (duration > 5) {
      await addSession({
        taskId: taskId === "none" ? undefined : taskId,
        startTime: start, endTime: end, duration, type: mode,
      });
    }
    toast.success(`${mode === "focus" ? "Focus" : "Break"} complete`);
    if (settings.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(`${mode === "focus" ? "Focus" : "Break"} complete`, { body: "Time for the next round." });
    }
    if (mode === "focus") {
      const next = completedRounds + 1;
      setCompletedRounds(next);
      const isLong = next % settings.pomodoroLongEvery === 0;
      setMode("break");
      setSecondsLeft((isLong ? settings.pomodoroLongBreak : settings.pomodoroBreak) * 60);
    } else {
      setMode("focus");
      setSecondsLeft(settings.pomodoroFocus * 60);
    }
    startRef.current = null;
  };

  const start = () => {
    startRef.current = Date.now() - (
      ((mode === "focus" ? settings.pomodoroFocus : settings.pomodoroBreak) * 60 - secondsLeft) * 1000
    );
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setSecondsLeft((mode === "focus" ? settings.pomodoroFocus : settings.pomodoroBreak) * 60);
    startRef.current = null;
  };
  const skip = () => completeSession();

  const m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
  const totalSec = (mode === "focus" ? settings.pomodoroFocus : settings.pomodoroBreak) * 60;
  const pct = Math.max(0, Math.min(100, ((totalSec - secondsLeft) / totalSec) * 100));

  const todaySessions = sessionsOnDay(sessions, new Date());
  const totalFocusToday = Math.round(todaySessions.reduce((a, x) => a + x.duration, 0) / 60);

  return (
    <PageContainer>
      <PageHeader title="Pomodoro" description="Focus in short cycles. Sessions are saved and feed your analytics." />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border bg-card p-10 grid place-items-center">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{mode}</div>
            <div className="relative inline-grid place-items-center">
              <svg width="240" height="240" viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="oklch(0.26 0.014 65)" strokeWidth="4" />
                <circle cx="50" cy="50" r="46" fill="none"
                  stroke={mode === "focus" ? "oklch(0.78 0.13 70)" : "oklch(0.70 0.13 145)"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 289} 289`}
                  className="transition-all duration-1000" />
              </svg>
              <div className={cn(
                "absolute font-display tabular-nums text-6xl font-semibold",
                running && "animate-pulse-ring rounded-full",
              )}>
                {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              {!running ? (
                <Button size="lg" onClick={start}><Play className="h-4 w-4 mr-1" /> Start</Button>
              ) : (
                <Button size="lg" variant="outline" onClick={pause}><Pause className="h-4 w-4 mr-1" /> Pause</Button>
              )}
              <Button size="lg" variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
              <Button size="lg" variant="ghost" onClick={skip}><SkipForward className="h-4 w-4" /></Button>
            </div>

            <div className="mt-6 text-xs text-muted-foreground">
              Round {completedRounds + 1} · Long break every {settings.pomodoroLongEvery}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Focusing on</div>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="No task" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task</SelectItem>
                {tasks.filter((t) => t.status !== "done").map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Today</div>
            <div className="text-3xl font-display font-semibold tabular-nums">{fmt.duration(totalFocusToday)}</div>
            <div className="text-xs text-muted-foreground">{todaySessions.length} sessions</div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Settings</div>
            <div className="space-y-2">
              <NumRow label="Focus" value={settings.pomodoroFocus} onChange={(v) => updateSettings({ pomodoroFocus: v })} />
              <NumRow label="Short break" value={settings.pomodoroBreak} onChange={(v) => updateSettings({ pomodoroBreak: v })} />
              <NumRow label="Long break" value={settings.pomodoroLongBreak} onChange={(v) => updateSettings({ pomodoroLongBreak: v })} />
              <NumRow label="Long every" value={settings.pomodoroLongEvery} onChange={(v) => updateSettings({ pomodoroLongEvery: v })} suffix="rounds" />
            </div>
            <Button size="sm" variant="outline" className="w-full mt-3"
              onClick={async () => {
                if ("Notification" in window) {
                  const p = await Notification.requestPermission();
                  if (p === "granted") {
                    await updateSettings({ notificationsEnabled: true });
                    toast.success("Notifications enabled");
                  }
                }
              }}>
              {settings.notificationsEnabled ? "Notifications on" : "Enable notifications"}
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent sessions</div>
            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
              {[...todaySessions].reverse().slice(0, 8).map((s) => {
                const t = tasks.find((x) => x.id === s.taskId);
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1">
                    <span className="truncate">{t ? t.title : "Untitled"}</span>
                    <span className="text-muted-foreground tabular-nums">{fmt.duration(s.duration / 60)}</span>
                  </div>
                );
              })}
              {todaySessions.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No sessions yet today.</div>}
            </div>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function NumRow({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value) || 1)}
          className="w-16 h-7 rounded border bg-input px-2 text-right tabular-nums" />
        <span className="text-muted-foreground text-[10px] w-10">{suffix ?? "min"}</span>
      </div>
    </div>
  );
}
