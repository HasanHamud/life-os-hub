import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/core/store";
import { usePomodoro } from "@/core/timer-store";
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

function PomodoroPage() {
  const { tasks, sessions, settings, addSession, updateSettings } = useStore();
  const pomo = usePomodoro();
  const [, force] = useState(0);

  // initialize seconds based on settings if idle
  useEffect(() => {
    pomo.init(settings.pomodoroFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pomodoroFocus]);

  // tick every second
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // detect completion (mirror logic so it triggers even when widget isn't mounted)
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

  const secondsLeft = pomo.running && pomo.endsAt
    ? Math.max(0, Math.round((pomo.endsAt - Date.now()) / 1000))
    : pomo.remaining;

  const m = Math.floor(secondsLeft / 60), s = secondsLeft % 60;
  const totalSec = pomo.totalSeconds || (pomo.mode === "focus" ? settings.pomodoroFocus : settings.pomodoroBreak) * 60;
  const pct = Math.max(0, Math.min(100, ((totalSec - secondsLeft) / totalSec) * 100));

  const todaySessions = sessionsOnDay(sessions, new Date());
  const totalFocusToday = Math.round(todaySessions.reduce((a, x) => a + x.duration, 0) / 60);

  return (
    <PageContainer>
      <PageHeader title="Pomodoro" description="Focus in short cycles. Sessions are saved and feed your analytics." />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border bg-card p-10 grid place-items-center">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{pomo.mode}</div>
            <div className="relative inline-grid place-items-center">
              <svg width="240" height="240" viewBox="0 0 100 100" className="-rotate-90">
                <circle cx="50" cy="50" r="46" fill="none" stroke="oklch(0.26 0.014 65)" strokeWidth="4" />
                <circle cx="50" cy="50" r="46" fill="none"
                  stroke={pomo.mode === "focus" ? "oklch(0.78 0.13 70)" : "oklch(0.70 0.13 145)"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 289} 289`}
                  className="transition-all duration-1000" />
              </svg>
              <div className={cn(
                "absolute font-display tabular-nums text-6xl font-semibold",
                pomo.running && "animate-pulse-ring rounded-full",
              )}>
                {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              {!pomo.running ? (
                <Button size="lg" onClick={() => pomo.start(settings.pomodoroFocus, settings.pomodoroBreak)}>
                  <Play className="h-4 w-4 mr-1" /> Start
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => pomo.pause()}>
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
              )}
              <Button size="lg" variant="ghost" onClick={() => pomo.reset(settings.pomodoroFocus, settings.pomodoroBreak)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => {
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
                toast.success("Skipped to next");
              }}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 text-xs text-muted-foreground">
              Round {pomo.completedRounds + 1} · Long break every {settings.pomodoroLongEvery}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Focusing on</div>
            <Select value={pomo.taskId ?? "none"} onValueChange={(v) => pomo.setTask(v === "none" ? undefined : v)}>
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
