import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { eachDayOfInterval, subDays, format, isSameDay, startOfDay, endOfDay } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { fmt, formatWhen } from "@/core/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Pencil } from "lucide-react";
import { ChartCard } from "@/components/common/ChartCard";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: i18n.t("meta.analytics") },
    { name: "description", content: "Productivity trends, focus time, and consistency." },
  ]}),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { t } = useTranslation();
  const { tasks, sessions, tags } = useStore();

  const last30 = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }), []);

  const focusPerDay = last30.map((d) => {
    const total = sessions
      .filter((s) => s.type === "focus" && isSameDay(s.startTime, d))
      .reduce((a, s) => a + s.duration / 60, 0);
    return { date: formatWhen(d, "MMM d"), minutes: Math.round(total) };
  });

  const completedPerDay = last30.map((d) => ({
    date: formatWhen(d, "MMM d"),
    count: tasks.filter((t) => t.completedAt && isSameDay(t.completedAt, d)).length,
  }));

  const tagBreakdown = tags.map((tag) => {
    const tIds = tasks.filter((t) => t.tagIds.includes(tag.id)).map((t) => t.id);
    const minutes = sessions
      .filter((s) => s.taskId && tIds.includes(s.taskId))
      .reduce((a, s) => a + s.duration / 60, 0);
    return { name: tag.name, value: Math.round(minutes), color: tag.color };
  }).filter((x) => x.value > 0);

  // Metrics
  const last7Focus = focusPerDay.slice(-7).reduce((a, x) => a + x.minutes, 0);
  const focusScore = Math.min(100, Math.round((last7Focus / (60 * 7)) * 100)); // target 1h/day
  const consistencyDays = focusPerDay.slice(-14).filter((x) => x.minutes > 0).length;
  const consistencyScore = Math.round((consistencyDays / 14) * 100);
  const totalDone = tasks.filter((t) => t.status === "done").length;

  const cardClass = "rounded-xl border bg-card p-4";

  return (
    <PageContainer>
      <PageHeader title={t("analytics.title")} description="Productivity trends and focus." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Focus score" value={`${focusScore}`} suffix="/100" hint="Last 7 days vs 1h/day target" />
        <Stat label="Consistency" value={`${consistencyScore}%`} hint="Active days, last 14" />
        <Stat label={t("analytics.focusWeek")} value={fmt.duration(last7Focus)} hint={t("analytics.totalMinutes")} />
        <Stat label="Tasks completed" value={String(totalDone)} hint="All time" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Focus minutes — last 30 days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={focusPerDay}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--chart-text)", fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="minutes" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasks completed">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={completedPerDay}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--chart-text)", fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="var(--chart-success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Time by tag">
          {tagBreakdown.length === 0
            ? <div className="h-[220px] grid place-items-center text-xs text-muted-foreground">{t("analytics.byTagEmpty")}</div>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={tagBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {tagBreakdown.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v: any) => `${fmt.duration(Number(v) || 0)}`} />
                </PieChart>
              </ResponsiveContainer>}
        </ChartCard>
      </div>

      <ProjectFocusAnalysis />

      <FocusAdjuster />

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Summary title="Daily summary" range="today" />
        <Summary title="Weekly summary" range="week" />
        <Summary title="Monthly summary" range="month" />
      </div>
    </PageContainer>
  );
}

function ProjectFocusAnalysis() {
  const { t } = useTranslation();
  const { projects, tasks, sessions } = useStore();
  const [range, setRange] = useState<7 | 30 | 90 | 0>(30);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const now = Date.now();
  const start = range === 0 ? 0 : subDays(new Date(), range).getTime();

  const taskProjectMap = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => { if (t.projectId) m.set(t.id, t.projectId); });
    return m;
  }, [tasks]);

  const sessionProjectId = (s: typeof sessions[number]) =>
    s.projectId ?? (s.taskId ? taskProjectMap.get(s.taskId) : undefined);

  const categories = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [projects]);

  const stats = useMemo(() => {
    const inRange = sessions.filter(
      (s) => s.type === "focus" && s.startTime >= start && s.startTime <= now && s.notes !== "__adjustment",
    );
    const rows = projects
      .filter((p) => !p.archived)
      .filter((p) => categoryFilter === "all" || (p.category ?? "") === categoryFilter)
      .map((p) => {
        const projSessions = inRange.filter((s) => sessionProjectId(s) === p.id);
        const minutes = Math.round(projSessions.reduce((a, s) => a + s.duration, 0) / 60);
        const projTasks = tasks.filter((t) => t.projectId === p.id && !t.archived);
        const completed = projTasks.filter(
          (t) => t.completedAt && t.completedAt >= start && t.completedAt <= now,
        ).length;
        return {
          id: p.id,
          name: p.name,
          color: p.color || "var(--chart-primary)",
          category: p.category || "—",
          minutes,
          totalTasks: projTasks.length,
          openTasks: projTasks.filter((t) => t.status !== "done").length,
          completed,
          sessions: projSessions.length,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    const uncategorizedMinutes = Math.round(
      inRange
        .filter((s) => !sessionProjectId(s))
        .reduce((a, s) => a + s.duration, 0) / 60,
    );

    return { rows, uncategorizedMinutes, totalMinutes: rows.reduce((a, r) => a + r.minutes, 0) };
  }, [projects, tasks, sessions, start, now, categoryFilter, taskProjectMap]);

  const chartData = stats.rows.filter((r) => r.minutes > 0).slice(0, 10);

  return (
    <div className="rounded-xl border bg-card p-4 mt-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-sm font-semibold">{t("analytics.projectFocus")}</div>
          <div className="text-[11px] text-muted-foreground">
            {t("analytics.tracked")} <span className="text-foreground font-medium">{fmt.duration(stats.totalMinutes)}</span>
            {stats.uncategorizedMinutes > 0 && <> · {t("analytics.noProject", { time: fmt.duration(stats.uncategorizedMinutes) })}</>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("analytics.allCategories")}</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {([7, 30, 90, 0] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setRange(r)}
            >
              {r === 0 ? "All time" : `${r}d`}
            </Button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-[200px] grid place-items-center text-xs text-muted-foreground">
          No focus sessions linked to projects in this range.
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "var(--chart-text)", fontSize: 10 }} width={100} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => fmt.duration(Number(v) || 0)}
              />
              <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                {chartData.map((d) => <Cell key={d.id} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={chartData} dataKey="minutes" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                {chartData.map((d) => <Cell key={d.id} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => fmt.duration(Number(v) || 0)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {stats.rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                <th className="py-2 pe-3">{t("analytics.project")}</th>
                <th className="py-2 pe-3">{t("analytics.category")}</th>
                <th className="py-2 pe-3 text-end">{t("analytics.focus")}</th>
                <th className="py-2 pe-3 text-end">{t("analytics.sessions")}</th>
                <th className="py-2 pe-3 text-end">{t("analytics.tasksDone")}</th>
                <th className="py-2 pe-3 text-end">{t("analytics.openTotal")}</th>
                <th className="py-2 text-end">{t("analytics.share")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {stats.rows.map((r) => {
                const share = stats.totalMinutes > 0 ? Math.round((r.minutes / stats.totalMinutes) * 100) : 0;
                return (
                  <tr key={r.id}>
                    <td className="py-2 pe-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </span>
                    </td>
                    <td className="py-2 pe-3 text-muted-foreground">{r.category}</td>
                    <td className="py-2 pe-3 text-end tabular-nums font-medium">{fmt.duration(r.minutes)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{r.sessions}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{r.completed}</td>
                    <td className="py-2 pe-3 text-end tabular-nums text-muted-foreground">{r.openTasks} / {r.totalTasks}</td>
                    <td className="py-2 text-end tabular-nums text-muted-foreground">{share}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FocusAdjuster() {
  const { t } = useTranslation();
  const { sessions, adjustDayFocus, setDayFocus, deleteSession, updateSession } = useStore();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [delta, setDelta] = useState<string>("15");
  const [target, setTarget] = useState<string>("");

  const day = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }, [date]);

  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  const daySessions = sessions
    .filter((s) => s.type === "focus" && s.startTime >= dayStart && s.startTime <= dayEnd)
    .sort((a, b) => a.startTime - b.startTime);
  const totalMin = Math.round(daySessions.reduce((a, s) => a + s.duration, 0) / 60);

  const apply = async (sign: 1 | -1) => {
    const n = Number(delta);
    if (!n || isNaN(n)) return;
    await adjustDayFocus(day, sign * Math.abs(n));
    const count = Math.abs(n);
    const dateLabel = formatWhen(day, "MMM d");
    toast.success(sign > 0 ? t("analytics.added", { count, date: dateLabel }) : t("analytics.removed", { count, date: dateLabel }));
  };

  const setTotal = async () => {
    const n = Number(target);
    if (isNaN(n) || n < 0) { toast.error("Enter a non-negative number"); return; }
    await setDayFocus(day, n);
    setTarget("");
    toast.success(t("analytics.setFocus", { date: formatWhen(day, "MMM d"), time: fmt.duration(n) }));
  };

  const editEntry = async (id: string, currentMin: number) => {
    const v = window.prompt("Set duration in minutes (negative allowed):", String(currentMin));
    if (v == null) return;
    const n = Number(v);
    if (isNaN(n)) { toast.error("Invalid number"); return; }
    const seconds = Math.round(n * 60);
    const ses = sessions.find((s) => s.id === id);
    if (!ses) return;
    await updateSession(id, { duration: seconds, endTime: ses.startTime + seconds * 1000 });
    toast.success(t("analytics.updated"));
  };

  return (
    <div className="rounded-xl border bg-card p-4 mt-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">{t("analytics.adjust")}</div>
          <div className="text-[11px] text-muted-foreground">{t("analytics.adjustHelp")}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          {t("analytics.current")} <span className="font-medium tabular-nums text-foreground">{fmt.duration(totalMin)}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("common.date")}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("analytics.adjustBy")}</Label>
          <div className="flex gap-2">
            <Input type="number" min={1} value={delta} onChange={(e) => setDelta(e.target.value)} />
            <Button variant="outline" size="icon" onClick={() => apply(-1)} title="Subtract">
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={() => apply(1)} title={t("common.add")}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("analytics.orSet")}</Label>
          <div className="flex gap-2">
            <Input
              type="number" min={0} placeholder={String(totalMin)}
              value={target} onChange={(e) => setTarget(e.target.value)}
            />
            <Button variant="outline" onClick={setTotal}>{t("analytics.set")}</Button>
          </div>
        </div>
      </div>

      {daySessions.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Sessions on {formatWhen(day, "EEE, MMM d")}
          </div>
          <div className="divide-y divide-border/50 rounded-md border">
            {daySessions.map((s) => {
              const mins = Math.round(s.duration / 60);
              const isAdj = s.notes === "__adjustment";
              return (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="text-[11px] font-mono text-muted-foreground w-12 tabular-nums">
                    {format(s.startTime, "HH:mm")}
                  </span>
                  <span className="flex-1 truncate">
                    {isAdj ? <span className="text-muted-foreground italic">{t("analytics.manual")}</span> : (s.notes || t("analytics.focusSession"))}
                  </span>
                  <span className={`tabular-nums font-medium ${mins < 0 ? "text-destructive" : ""}`}>
                    {mins >= 0 ? "+" : ""}{mins}m
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editEntry(s.id, mins)} title={t("common.edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={async () => { await deleteSession(s.id); toast.success(t("analytics.removedSession")); }}
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ title, range }: { title: string; range: "today" | "week" | "month" }) {
  const { t } = useTranslation();
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
        <Row label={t("analytics.focusTime")} value={fmt.duration(focusMin)} />
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

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

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

// ChartCard imported from "@/components/common/ChartCard"