import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { eachDayOfInterval, subDays, format, isSameDay, startOfDay, endOfDay } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { fmt } from "@/core/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics — Life OS" },
    { name: "description", content: "Productivity trends, focus time, planned vs actual, and consistency." },
  ]}),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { tasks, sessions, timeBlocks, tags } = useStore();

  const last30 = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }), []);

  const focusPerDay = last30.map((d) => {
    const total = sessions
      .filter((s) => s.type === "focus" && isSameDay(s.startTime, d))
      .reduce((a, s) => a + s.duration / 60, 0);
    return { date: format(d, "MMM d"), minutes: Math.round(total) };
  });

  const completedPerDay = last30.map((d) => ({
    date: format(d, "MMM d"),
    count: tasks.filter((t) => t.completedAt && isSameDay(t.completedAt, d)).length,
  }));

  const tagBreakdown = tags.map((tag) => {
    const tIds = tasks.filter((t) => t.tagIds.includes(tag.id)).map((t) => t.id);
    const minutes = sessions
      .filter((s) => s.taskId && tIds.includes(s.taskId))
      .reduce((a, s) => a + s.duration / 60, 0);
    return { name: tag.name, value: Math.round(minutes), color: tag.color };
  }).filter((x) => x.value > 0);

  const plannedVsActual = last30.slice(-14).map((d) => {
    const planned = timeBlocks
      .filter((b) => isSameDay(b.startTime, d))
      .reduce((a, b) => a + (b.endTime - b.startTime) / 60_000, 0);
    const actual = sessions
      .filter((s) => isSameDay(s.startTime, d) && s.type === "focus")
      .reduce((a, s) => a + s.duration / 60, 0);
    return { date: format(d, "EEE d"), planned: Math.round(planned), actual: Math.round(actual) };
  });

  // Metrics
  const last7Focus = focusPerDay.slice(-7).reduce((a, x) => a + x.minutes, 0);
  const focusScore = Math.min(100, Math.round((last7Focus / (60 * 7)) * 100)); // target 1h/day
  const consistencyDays = focusPerDay.slice(-14).filter((x) => x.minutes > 0).length;
  const consistencyScore = Math.round((consistencyDays / 14) * 100);
  const totalDone = tasks.filter((t) => t.status === "done").length;

  const cardClass = "rounded-xl border bg-card p-4";

  return (
    <PageContainer>
      <PageHeader title="Analytics" description="Productivity trends, focus, and planned vs actual." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Focus score" value={`${focusScore}`} suffix="/100" hint="Last 7 days vs 1h/day target" />
        <Stat label="Consistency" value={`${consistencyScore}%`} hint="Active days, last 14" />
        <Stat label="Focus this week" value={fmt.duration(last7Focus)} hint="Total minutes" />
        <Stat label="Tasks completed" value={String(totalDone)} hint="All time" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Focus minutes — last 30 days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={focusPerDay}>
              <CartesianGrid stroke="oklch(0.26 0.014 65)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.014 64)", border: "1px solid oklch(0.30 0.022 70)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="minutes" fill="oklch(0.78 0.13 70)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasks completed">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={completedPerDay}>
              <CartesianGrid stroke="oklch(0.26 0.014 65)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.014 64)", border: "1px solid oklch(0.30 0.022 70)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="oklch(0.70 0.13 145)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Planned vs actual — last 14 days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plannedVsActual}>
              <CartesianGrid stroke="oklch(0.26 0.014 65)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <YAxis tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.014 64)", border: "1px solid oklch(0.30 0.022 70)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="planned" fill="oklch(0.70 0.10 230)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="oklch(0.78 0.13 70)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Time by tag">
          {tagBreakdown.length === 0
            ? <div className="h-[220px] grid place-items-center text-xs text-muted-foreground">No tagged sessions yet.</div>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={tagBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {tagBreakdown.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.22 0.014 64)", border: "1px solid oklch(0.30 0.022 70)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => `${fmt.duration(Number(v) || 0)}`} />
                </PieChart>
              </ResponsiveContainer>}
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Summary title="Daily summary" range="today" />
        <Summary title="Weekly summary" range="week" />
        <Summary title="Monthly summary" range="month" />
      </div>
    </PageContainer>
  );
}

function Summary({ title, range }: { title: string; range: "today" | "week" | "month" }) {
  const { tasks, sessions } = useStore();
  const now = new Date();
  const start = range === "today" ? startOfDay(now).getTime()
    : range === "week" ? subDays(now, 7).getTime()
    : subDays(now, 30).getTime();
  const end = endOfDay(now).getTime();

  const focusMin = Math.round(sessions.filter((s) => s.type === "focus" && s.startTime >= start && s.startTime <= end)
    .reduce((a, s) => a + s.duration, 0) / 60);
  const completed = tasks.filter((t) => t.completedAt && t.completedAt >= start && t.completedAt <= end).length;
  const created = tasks.filter((t) => t.createdAt >= start && t.createdAt <= end).length;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
      <div className="space-y-1.5 text-sm">
        <Row label="Focus time" value={fmt.duration(focusMin)} />
        <Row label="Tasks completed" value={String(completed)} />
        <Row label="Tasks created" value={String(created)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Stat({ label, value, suffix, hint }: { label: string; value: string; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-display font-semibold tabular-nums">
        {value}{suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}
