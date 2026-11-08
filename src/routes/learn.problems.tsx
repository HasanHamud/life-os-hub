import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";
import { useLearnStore } from "@/core/learn-store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProblemCard } from "@/components/learn/ProblemCard";
import { ProblemForm } from "@/components/learn/ProblemForm";
import { Plus, Code } from "lucide-react";

const PATTERNS = [
  "two-pointer", "sliding-window", "prefix-sum", "binary-search",
  "hash-map", "stack", "queue", "bfs", "dfs", "dp", "greedy",
  "sorting", "recursion", "backtracking", "math", "string",
];

export const Route = createFileRoute("/learn/problems")({
  head: () => ({
    meta: [
      { title: i18n.t("meta.problems") },
      { name: "description", content: "Competitive programming problem bank — track patterns and progress." },
    ],
  }),
  component: ProblemsPage,
});

function ProblemsPage() {
  const { t } = useTranslation();
  const { problems, distinctSubjects, upsertProblem, deleteProblem } = useLearnStore();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterPattern, setFilterPattern] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const subjects = distinctSubjects();

  const editing = editingId ? problems.find((p) => p.id === editingId) : undefined;

  const filtered = useMemo(() => {
    let list = [...problems].sort((a, b) => Number(a.completed) - Number(b.completed));
    if (filterSubject !== "all") list = list.filter((p) => p.subject === filterSubject);
    if (filterPattern !== "all") list = list.filter((p) => p.patternClass === filterPattern);
    if (filterStatus === "done") list = list.filter((p) => p.completed);
    if (filterStatus === "open") list = list.filter((p) => !p.completed);
    return list;
  }, [problems, filterSubject, filterPattern, filterStatus]);

  const usedPatterns = useMemo(() => {
    const s = new Set(problems.map((p) => p.patternClass).filter(Boolean));
    return PATTERNS.filter((p) => s.has(p));
  }, [problems]);

  return (
    <div>
      <PageHeader
        title={t("learn.problems")}
        description="Track CP problems by pattern class. Learn to recognize patterns."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 me-1" />{t("learn.newProblem")}
          </Button>
        }
      />

      {problems.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("learn.allSubjects")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("learn.allSubjects")}</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPattern} onValueChange={setFilterPattern}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("learn.allPatterns")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("learn.allPatterns")}</SelectItem>
              {usedPatterns.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder={t("learn.allStatus")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="open">{t("common.open")}</SelectItem>
              <SelectItem value="done">{t("more.completed")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {filtered.length} problem{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Code className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
          <div className="text-sm text-muted-foreground">
            {problems.length === 0 ? "No problems yet. Add your first problem." : "No problems match the current filters."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((problem) => (
            <ProblemCard
              key={problem.id}
              problem={problem}
              onEdit={() => setEditingId(problem.id)}
              onDelete={async () => { await deleteProblem(problem.id); }}
              onToggle={async () => {
                await upsertProblem({ id: problem.id, completed: !problem.completed });
              }}
            />
          ))}
        </div>
      )}

      <ProblemForm
        open={creating || !!editingId}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditingId(null); } }}
        problem={editing}
        subjects={subjects}
        onSubmit={async (data) => {
          await upsertProblem(data);
          setCreating(false);
          setEditingId(null);
        }}
        onDelete={editingId ? async () => { await deleteProblem(editingId); setEditingId(null); } : undefined}
      />
    </div>
  );
}
