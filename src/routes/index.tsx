import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/core/store";
import { useLearnStore } from "@/core/learn-store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { TaskRow } from "@/components/tasks/TaskCard";
import { fmt, blocksOnDay, focusMinutesOnDay, isDueToday, isOverdue, taskScore } from "@/core/utils";
import { Calendar, Clock, Flame, CheckCircle2, AlertTriangle, Target as TargetIcon, GraduationCap } from "lucide-react";
import { useState } from "react";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/common/Card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Life OS" },
      { name: "description", content: "Today's tasks, time blocks, focus stats and what matters most." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { tasks, timeBlocks, sessions, goals } = useStore();
  const today = new Date();

  const dueToday = tasks.filter((t) => isDueToday(t) && t.status !== "done");
  const overdue = tasks.filter(isOverdue);
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const todayBlocks = blocksOnDay(timeBlocks, today);
  const focusMin = focusMinutesOnDay(sessions, today);
  const completedToday = tasks.filter((t) => t.completedAt && new Date(t.completedAt).toDateString() === today.toDateString()).length;
  const top = [...tasks].filter((t) => t.status !== "done").sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 5);

  const [openTask, setOpenTask] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title={`Good ${greet()}, today is ${fmt.day(today.getTime())}`}
        description={`${fmt.date(today.getTime())} · Plan, focus, ship.`}
        actions={<Button onClick={() => setCreating(true)}>+ Quick task</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat icon={CheckCircle2} label="Done today" value={completedToday} accent="text-success" />
        <Stat icon={Clock} label="Focus time" value={fmt.duration(focusMin)} accent="text-primary" />
        <Stat icon={Flame} label="In progress" value={inProgress.length} accent="text-warning" />
        <Stat icon={AlertTriangle} label="Overdue" value={overdue.length} accent="text-destructive" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card title="Top of mind" subtitle="Auto-prioritized by urgency, deadline & age">
            {top.length === 0
              ? <EmptyState>Nothing on deck. Take a breath.</EmptyState>
              : <div className="divide-y divide-border/50">
                  {top.map((t) => <TaskRow key={t.id} task={t} onClick={() => setOpenTask(t.id)} />)}
                </div>}
          </Card>

          <Card title="Due today" right={<Link to="/tasks" className="text-xs text-primary hover:underline">All tasks →</Link>}>
            {dueToday.length === 0
              ? <EmptyState>Nothing due today.</EmptyState>
              : <div className="divide-y divide-border/50">
                  {dueToday.map((t) => <TaskRow key={t.id} task={t} onClick={() => setOpenTask(t.id)} />)}
                </div>}
          </Card>
        </section>

        <aside className="space-y-6">
          <Card title="Today's blocks" right={<Link to="/time" className="text-xs text-primary hover:underline">Plan →</Link>}>
            {todayBlocks.length === 0
              ? <EmptyState>No blocks scheduled.</EmptyState>
              : <div className="space-y-2">
                  {todayBlocks.map((b) => {
                    const linked = b.taskId ? tasks.find((t) => t.id === b.taskId) : undefined;
                    return (
                      <div key={b.id} className="flex items-start gap-3 rounded-md bg-muted/30 p-2.5">
                        <div className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0 pt-0.5">
                          {fmt.time(b.startTime)}<br />{fmt.time(b.endTime)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{b.title}</div>
                          {linked && <div className="text-[11px] text-muted-foreground truncate">↳ {linked.title}</div>}
                          <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{b.type}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </Card>

          <TodayLearningCard />

          <Card title="Active goals" right={<Link to="/goals" className="text-xs text-primary hover:underline">All →</Link>}>
            {goals.length === 0
              ? <EmptyState>No goals set.</EmptyState>
              : <div className="space-y-3">
                  {goals.slice(0, 3).map((g) => {
                    const linked = tasks.filter((t) => t.goalId === g.id);
                    const done = linked.filter((t) => t.status === "done").length;
                    const pct = linked.length ? Math.round((done / linked.length) * 100) : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium truncate flex items-center gap-1.5">
                            <TargetIcon className="h-3 w-3 text-primary" />
                            {g.title}
                          </span>
                          <span className="text-muted-foreground tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-warning" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </Card>
        </aside>
      </div>

      <TaskDialog open={!!openTask} onOpenChange={(v) => !v && setOpenTask(null)} taskId={openTask} />
      <TaskDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        {label}
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TodayLearningCard() {
  const { insights, concepts, sessions } = useLearnStore();
  const rotation = useLearnStore((s) => s.rotation);
  const today = new Date().getDay();
  const entry = rotation.find((r) => r.dayOfWeek === today);
  const mod = entry && entry.enabled ? { subject: entry.subject, icon: entry.icon } : { subject: "Rest", icon: "🧘" };
  const todayStr = formatToday();

  const todayInsights = insights.filter((i) => i.date === todayStr).length;
  const streak = calcStreak(sessions.map((s) => s.date));

  return (
    <Card title="Today's Learning" right={<Link to="/learn" className="text-xs text-primary hover:underline">Open →</Link>}>
      <div className="p-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{mod.icon}</span>
          <div>
            <div className="text-sm font-medium">{mod.subject} Day</div>
            <div className="text-[10px] text-muted-foreground">
              {concepts.length} concepts · {insights.length} insights
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 mt-1">
          <span>Insights today: {todayInsights}</span>
          <span>🔥 {streak}d streak</span>
        </div>
      </div>
    </Card>
  );
}

function formatToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;
    if (set.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
