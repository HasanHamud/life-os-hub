import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useLearnStore } from "@/core/learn-store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsightCard } from "@/components/learn/InsightCard";
import { InsightForm } from "@/components/learn/InsightForm";
import { Plus, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/learn/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Life OS" },
      { name: "description", content: "Learning insights journal — track what you learn every day." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { insights, distinctSubjects, upsertInsight, deleteInsight } = useLearnStore();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const subjects = distinctSubjects();

  const editing = editingId ? insights.find((i) => i.id === editingId) : undefined;
  const creatingFrom = editingId ? undefined : undefined;

  const filtered = useMemo(() => {
    let list = [...insights].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    if (filterSubject !== "all") {
      list = list.filter((i) => i.subject === filterSubject);
    }
    return list;
  }, [insights, filterSubject]);

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Log what you learn. One key idea per session."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />New Insight
          </Button>
        }
      />

      {insights.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {filtered.length} insight{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">
              {filterSubject !== "all" ? "No insights for this subject yet." : "No insights yet. Log your first insight!"}
            </div>
          </div>
        ) : (
          filtered.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onEdit={() => setEditingId(insight.id)}
              onDelete={async () => { await deleteInsight(insight.id); }}
            />
          ))
        )}
      </div>

      <InsightForm
        open={creating || !!editingId}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditingId(null); } }}
        insight={editing}
        subjects={subjects}
        onSubmit={async (data) => {
          await upsertInsight(data);
          setCreating(false);
          setEditingId(null);
        }}
        onDelete={editingId ? async () => { await deleteInsight(editingId); setEditingId(null); } : undefined}
      />
    </div>
  );
}
