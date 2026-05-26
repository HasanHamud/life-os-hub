import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useLearnStore } from "@/core/learn-store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { PhaseProgressBar } from "@/components/learn/PhaseProgressBar";
import { StreakChart } from "@/components/learn/StreakChart";
import { Brain, Lightbulb, Code, Clock, TrendingUp, FileText } from "lucide-react";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/learn/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Life OS" },
      { name: "description", content: "Learning analytics — streaks, phase progress, concepts mastered." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { concepts, insights, problems, sessions } = useLearnStore();

  const phaseData = useMemo(() => {
    const phaseMap = new Map<number, { total: number; clear: number; label: string }>();
    for (const c of concepts) {
      if (!phaseMap.has(c.phase)) {
        phaseMap.set(c.phase, { total: 0, clear: 0, label: getPhaseLabel(c.phase) });
      }
      const entry = phaseMap.get(c.phase)!;
      entry.total++;
      if (c.clarityRating >= 3) entry.clear++;
    }
    return Array.from(phaseMap.entries())
      .map(([phase, { total, clear, label }]) => ({
        phase,
        label,
        pct: total > 0 ? Math.round((clear / total) * 100) : 0,
      }))
      .sort((a, b) => a.phase - b.phase);
  }, [concepts]);

  const sessionDates = useMemo(
    () => sessions.map((s) => s.date),
    [sessions],
  );

  const avgClarity = useMemo(() => {
    if (concepts.length === 0) return 0;
    return Math.round(concepts.reduce((a, c) => a + c.clarityRating, 0) / concepts.length * 10) / 10;
  }, [concepts]);

  const totalTime = useMemo(
    () => sessions.reduce((a, s) => a + s.duration, 0),
    [sessions],
  );

  const completedProblems = useMemo(
    () => problems.filter((p) => p.completed).length,
    [problems],
  );

  const metrics = [
    { label: "Concepts", value: concepts.length, icon: Brain, color: "text-primary" },
    { label: "Avg clarity", value: avgClarity.toString(), suffix: "/5", icon: TrendingUp, color: "text-warning" },
    { label: "Problems done", value: completedProblems, icon: Code, color: "text-success" },
    { label: "Total time", value: totalTime >= 60 ? `${Math.round(totalTime / 60)}h` : `${totalTime}m`, icon: Clock, color: "text-info" },
    { label: "Insights", value: insights.length, icon: Lightbulb, color: "text-warning" },
  ];

  const exportWeekSummary = () => {
    const now = new Date();
    const mon = startOfWeek(now, { weekStartsOn: 1 });
    const sun = endOfWeek(now, { weekStartsOn: 1 });
    const weekInsights = insights.filter((i) => {
      const d = new Date(i.date);
      return d >= mon && d <= sun;
    });
    if (weekInsights.length === 0) {
      toast.error("No insights this week");
      return;
    }
    const lines: string[] = [
      `# Weekly Learning Summary — ${format(mon, "MMM d")} – ${format(sun, "MMM d, yyyy")}`,
      "",
    ];
    const bySubject = new Map<string, typeof weekInsights>();
    for (const ins of weekInsights) {
      if (!bySubject.has(ins.subject)) bySubject.set(ins.subject, []);
      bySubject.get(ins.subject)!.push(ins);
    }
    for (const [subject, insList] of bySubject) {
      lines.push(`## ${subject}`);
      lines.push("");
      for (const ins of insList) {
        lines.push(`### ${ins.date} — ${ins.keyIdea}`);
        for (const item of ins.insights.filter(Boolean)) {
          lines.push(`- ${item}`);
        }
        if (ins.mistakes) {
          lines.push(`  > Mistake: ${ins.mistakes}`);
        }
        lines.push("");
      }
    }
    lines.push("---");
    lines.push(`Total insights: ${weekInsights.length}`);
    const weekSubjects = new Set(weekInsights.map((i) => i.subject));
    lines.push(`Subjects: ${Array.from(weekSubjects).join(", ")}`);

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `learning-week-${format(mon, "yyyy-MM-dd")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Week summary exported");
  };

  return (
    <div>
      <PageHeader
        title="Progress"
        description="Track your learning journey across subjects and phases."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {metrics.map(({ label, value, suffix, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              {label}
            </div>
            <div className="text-2xl font-display font-semibold tabular-nums">
              {value}{suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end mb-4">
        <Button variant="outline" size="sm" onClick={exportWeekSummary}>
          <FileText className="h-4 w-4 mr-1" />
          Export Week Summary
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Phase Progress
          </div>
          {phaseData.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Add concepts with phase numbers to see progress.
            </div>
          ) : (
            <PhaseProgressBar phases={phaseData} />
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Learning Streak
          </div>
          <StreakChart sessionDates={sessionDates} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Subject Breakdown
        </div>
        {concepts.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3 text-right">Concepts</th>
                  <th className="py-2 pr-3 text-right">Avg Clarity</th>
                  <th className="py-2 pr-3 text-right">Insights</th>
                  <th className="py-2 pr-3 text-right">Problems</th>
                  <th className="py-2 text-right">Time (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {subjectsToRows(concepts, insights, problems, sessions).map((row) => (
                  <tr key={row.subject}>
                    <td className="py-2 pr-3 font-medium">{row.subject}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.concepts}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.avgClarity}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.insights}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.problems}</td>
                    <td className="py-2 text-right tabular-nums">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getPhaseLabel(phase: number): string {
  const labels: Record<number, string> = {
    1: "Foundation",
    2: "Structure Building",
    3: "Systems Thinking",
    4: "Advanced Integration",
  };
  return labels[phase] ?? `Phase ${phase}`;
}

function subjectsToRows(
  concepts: { subject: string; clarityRating: number }[],
  insights: { subject: string }[],
  problems: { subject: string }[],
  sessions: { subject: string; duration: number }[],
) {
  const subjects = new Set<string>();
  for (const c of concepts) subjects.add(c.subject);
  for (const i of insights) subjects.add(i.subject);
  for (const p of problems) subjects.add(p.subject);
  for (const s of sessions) subjects.add(s.subject);

  return Array.from(subjects).sort().map((subject) => {
    const subjectConcepts = concepts.filter((c) => c.subject === subject);
    const avgClarity = subjectConcepts.length
      ? Math.round(subjectConcepts.reduce((a, c) => a + c.clarityRating, 0) / subjectConcepts.length * 10) / 10
      : 0;
    return {
      subject,
      concepts: subjectConcepts.length,
      avgClarity,
      insights: insights.filter((i) => i.subject === subject).length,
      problems: problems.filter((p) => p.subject === subject).length,
      time: sessions.filter((s) => s.subject === subject).reduce((a, s) => a + s.duration, 0),
    };
  });
}
