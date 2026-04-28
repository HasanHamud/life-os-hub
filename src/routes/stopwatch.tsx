import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/core/store";
import { useStopwatch } from "@/core/timer-store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw, Square } from "lucide-react";
import { fmt, sessionsOnDay } from "@/core/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/stopwatch")({
  head: () => ({ meta: [
    { title: "Stopwatch — Life OS" },
    { name: "description", content: "Track exactly how long you work on something. Start, stop, save." },
  ]}),
  component: StopwatchPage,
});

function fmtHMS(totalMs: number) {
  const total = Math.floor(totalMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function StopwatchPage() {
  const { tasks, sessions, addSession } = useStore();
  const sw = useStopwatch();
  const [, force] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = sw.getElapsedMs();

  const handleStop = async () => {
    if (elapsedMs < 1000) {
      toast.info("Nothing to save yet.");
      return;
    }
    const session = sw.stop();
    await addSession({
      taskId: session.taskId,
      startTime: session.startedAt,
      endTime: session.endedAt,
      duration: Math.round(session.durationMs / 1000),
      type: "focus",
      notes: session.label,
    });
    toast.success(`Saved ${fmt.duration(Math.round(session.durationMs / 60000))}`);
  };

  const today = sessionsOnDay(sessions, new Date()).filter((s) => s.type === "focus");
  const totalToday = Math.round(today.reduce((a, x) => a + x.duration, 0) / 60);

  return (
    <PageContainer>
      <PageHeader title="Stopwatch" description="Track exactly how long you spend on something. Continues running across pages." />

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border bg-card p-10 grid place-items-center">
          <div className="text-center w-full">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              {sw.running ? "Running" : elapsedMs > 0 ? "Paused" : "Ready"}
            </div>
            <div className="font-display tabular-nums text-7xl font-semibold">
              {fmtHMS(elapsedMs)}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2">
              {!sw.running ? (
                <Button size="lg" onClick={() => sw.start()}>
                  <Play className="h-4 w-4 mr-1" /> {elapsedMs > 0 ? "Resume" : "Start"}
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={() => sw.pause()}>
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
              )}
              <Button size="lg" variant="default" onClick={handleStop} disabled={elapsedMs < 1000}>
                <Square className="h-4 w-4 mr-1" /> Stop & Save
              </Button>
              <Button size="lg" variant="ghost" onClick={() => { sw.reset(); toast.info("Stopwatch reset"); }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Working on</div>
              <Select value={sw.taskId ?? "none"} onValueChange={(v) => sw.setTask(v === "none" ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="No task" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No task</SelectItem>
                  {tasks.filter((t) => t.status !== "done").map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Label (optional)</div>
              <Input value={sw.label ?? ""} onChange={(e) => sw.setLabel(e.target.value || undefined)} placeholder="e.g. deep work, writing…" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Today</div>
            <div className="text-3xl font-display font-semibold tabular-nums">{fmt.duration(totalToday)}</div>
            <div className="text-xs text-muted-foreground">{today.length} sessions tracked</div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent sessions</div>
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
              {[...today].reverse().slice(0, 10).map((s) => {
                const t = tasks.find((x) => x.id === s.taskId);
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1">
                    <span className="truncate">{t ? t.title : s.notes ?? "Untitled"}</span>
                    <span className="text-muted-foreground tabular-nums">{fmt.duration(s.duration / 60)}</span>
                  </div>
                );
              })}
              {today.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No sessions yet today.</div>}
            </div>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
