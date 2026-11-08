import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/core/store";
import { useLearnStore } from "@/core/learn-store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { TaskRow } from "@/components/tasks/TaskCard";
import { fmt, focusMinutesOnDay, isDueToday, isOverdue, taskScore } from "@/core/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";
import { Clock, Flame, CheckCircle2, AlertTriangle, Target as TargetIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/common/Card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: i18n.t("meta.dashboard") },
      { name: "description", content: i18n.t("meta.dashboardDesc") },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, sessions, goals } = useStore();
  const today = new Date();
  const part = greet();

  const dueToday = tasks.filter((task) => isDueToday(task) && task.status !== "done");
  const overdue = tasks.filter(isOverdue);
  const inProgress = tasks.filter((task) => task.status === "in_progress");
  const focusMin = focusMinutesOnDay(sessions, today);
  const completedToday = tasks.filter((task) => task.completedAt && new Date(task.completedAt).toDateString() === today.toDateString()).length;
  const top = [...tasks].filter((task) => task.status !== "done").sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 5);

  return (
    <PageContainer>
      <PageHeader
        title={t("dashboard.greeting", { part: t(`dashboard.${part}`), day: fmt.day(today.getTime()) })}
        description={t("dashboard.tagline", { date: fmt.date(today.getTime()) })}
        actions={<Button onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: "new" }, search: { status: "todo" } })}>{t("dashboard.quickTask")}</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat icon={CheckCircle2} label={t("dashboard.doneToday")} value={completedToday} accent="text-success" tint="bg-success/15" shape="circle" />
        <Stat icon={Clock} label={t("dashboard.focusTime")} value={fmt.duration(focusMin)} accent="text-primary" tint="bg-primary/15" shape="diamond" ring={Math.min(100, Math.round((focusMin / 60) * 100))} />
        <Stat icon={Flame} label={t("dashboard.inProgress")} value={inProgress.length} accent="text-warning" tint="bg-warning/15" shape="circle" />
        <Stat icon={AlertTriangle} label={t("dashboard.overdue")} value={overdue.length} accent="text-destructive" tint="bg-destructive/15" shape="diamond" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card title={t("dashboard.top")} subtitle={t("dashboard.topHint")}>
            {top.length === 0
              ? <EmptyState>{t("dashboard.emptyTop")}</EmptyState>
              : <div className="divide-y divide-border/50">
                  {top.map((task) => <TaskRow key={task.id} task={task} onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })} />)}
                </div>}
          </Card>

          <Card title={t("dashboard.dueToday")} right={<Link to="/tasks" className="text-xs text-primary hover:underline">{t("dashboard.allTasks")}</Link>}>
            {dueToday.length === 0
              ? <EmptyState>{t("dashboard.emptyDue")}</EmptyState>
              : <div className="divide-y divide-border/50">
                  {dueToday.map((task) => <TaskRow key={task.id} task={task} onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })} />)}
                </div>}
          </Card>
        </section>

        <aside className="space-y-6">
          <TodayLearningCard />

          <Card title={t("dashboard.activeGoals")} right={<Link to="/goals" className="text-xs text-primary hover:underline">{t("dashboard.allGoals")}</Link>}>
            {goals.length === 0
              ? <EmptyState>{t("dashboard.noGoals")}</EmptyState>
              : <div className="space-y-3">
                  {goals.slice(0, 3).map((g) => {
                    const linked = tasks.filter((t) => t.goalId === g.id);
                    const done = linked.filter((t) => t.status === "done").length;
                    const pct = linked.length ? Math.round((done / linked.length) * 100) : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium truncate flex items-center gap-1.5">
                            <TargetIcon className="h-3 w-3 text-primary" />
                            {g.title}
                          </span>
                          <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
                            {pct}%
                            <Ring pct={pct} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </Card>
        </aside>
      </div>

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

function Stat({
  icon: Icon, label, value, accent, tint, shape, ring,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent: string;
  tint: string;
  shape: "circle" | "diamond";
  ring?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4">
      <div
        className={cn(
          "pointer-events-none absolute -right-4 -top-4 h-16 w-16",
          tint,
          shape === "diamond" ? "rotate-45 rounded-md" : "rounded-full"
        )}
      />
      <div className="relative mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-muted">
          <Icon className={cn("h-3.5 w-3.5", accent)} />
        </span>
        {label}
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
        {ring != null && <Ring pct={ring} />}
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const capped = Math.max(0, Math.min(100, pct));
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const filled = (capped / 100) * circumference;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--muted)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

function TodayLearningCard() {
  const { t } = useTranslation();
  const { insights, concepts, sessions } = useLearnStore();
  const rotation = useLearnStore((s) => s.rotation);
  const today = new Date().getDay();
  const entry = rotation.find((r) => r.dayOfWeek === today);
  const mod = entry && entry.enabled ? { subject: entry.subject, icon: entry.icon } : { subject: t("dashboard.rest"), icon: "🧘" };
  const todayStr = formatToday();

  const todayInsights = insights.filter((i) => i.date === todayStr).length;
  const streak = calcStreak(sessions.map((s) => s.date));

  return (
    <Card title={t("dashboard.learning")} right={<Link to="/learn" className="text-xs text-primary hover:underline">{t("dashboard.openLearn")}</Link>}>
      <div className="p-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{mod.icon}</span>
          <div>
            <div className="text-sm font-medium">{t("dashboard.daySubject", { subject: mod.subject })}</div>
            <div className="text-[10px] text-muted-foreground">
              {t("dashboard.counts", { concepts: concepts.length, insights: insights.length })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2 mt-1">
          <span>{t("dashboard.insightsToday", { count: todayInsights })}</span>
          <span>🔥 {t("dashboard.streak", { count: streak })}</span>
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
