import { Trash2, Pencil, Brain } from "lucide-react";
import { ClarityStars } from "./ClarityStars";
import type { Concept } from "@/core/learn-types";

export function ConceptCard({
  concept,
  onEdit,
  onDelete,
  onClarityChange,
}: {
  concept: Concept;
  onEdit: () => void;
  onDelete: () => void;
  onClarityChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 group hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <Brain className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{concept.title}</div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{concept.subject}</span>
              {concept.topic && <span>· {concept.topic}</span>}
              <span>· Phase {concept.phase}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="h-7 w-7 rounded-md hover:bg-accent grid place-items-center">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="h-7 w-7 rounded-md hover:bg-destructive/10 grid place-items-center">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>
      <ClarityStars value={concept.clarityRating} onChange={onClarityChange} />
      {concept.canExplainWithoutNotes && (
        <div className="text-[10px] text-success mt-1">Can explain without notes</div>
      )}
    </div>
  );
}
