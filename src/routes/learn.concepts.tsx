import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useLearnStore } from "@/core/learn-store";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConceptCard } from "@/components/learn/ConceptCard";
import { ConceptForm } from "@/components/learn/ConceptForm";
import { Plus, Brain } from "lucide-react";

export const Route = createFileRoute("/learn/concepts")({
  head: () => ({
    meta: [
      { title: "Concepts — Life OS" },
      { name: "description", content: "Concept library — track understanding and clarity across subjects." },
    ],
  }),
  component: ConceptsPage,
});

function ConceptsPage() {
  const { concepts, distinctSubjects, upsertConcept, deleteConcept } = useLearnStore();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterPhase, setFilterPhase] = useState("all");
  const subjects = distinctSubjects();

  const editing = editingId ? concepts.find((c) => c.id === editingId) : undefined;

  const filtered = useMemo(() => {
    let list = [...concepts].sort((a, b) => a.phase - b.phase || a.subject.localeCompare(b.subject));
    if (filterSubject !== "all") list = list.filter((c) => c.subject === filterSubject);
    if (filterPhase !== "all") list = list.filter((c) => c.phase === Number(filterPhase));
    return list;
  }, [concepts, filterSubject, filterPhase]);

  const phases = useMemo(() => {
    const s = new Set(concepts.map((c) => c.phase));
    return Array.from(s).sort();
  }, [concepts]);

  return (
    <div>
      <PageHeader
        title="Concepts"
        description="Track your understanding. Rate clarity for each concept."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />New Concept
          </Button>
        }
      />

      {concepts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPhase} onValueChange={setFilterPhase}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All phases" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All phases</SelectItem>
              {phases.map((p) => <SelectItem key={p} value={String(p)}>Phase {p}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {filtered.length} concept{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
          <div className="text-sm text-muted-foreground">
            {concepts.length === 0 ? "No concepts yet. Add your first concept." : "No concepts match the current filters."}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((concept) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              onEdit={() => setEditingId(concept.id)}
              onDelete={async () => { await deleteConcept(concept.id); }}
              onClarityChange={async (v) => {
                await upsertConcept({ id: concept.id, clarityRating: v });
              }}
            />
          ))}
        </div>
      )}

      <ConceptForm
        open={creating || !!editingId}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditingId(null); } }}
        concept={editing}
        subjects={subjects}
        onSubmit={async (data) => {
          await upsertConcept(data);
          setCreating(false);
          setEditingId(null);
        }}
        onDelete={editingId ? async () => { await deleteConcept(editingId); setEditingId(null); } : undefined}
      />
    </div>
  );
}
