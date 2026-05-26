import { Trash2, Pencil, Lightbulb } from "lucide-react";
import type { LearningInsight } from "@/core/learn-types";

export function InsightCard({
  insight,
  onEdit,
  onDelete,
}: {
  insight: LearningInsight;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 group hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {insight.date}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{insight.subject}</span>
              {insight.topic && (
                <span className="text-[10px] text-muted-foreground">· {insight.topic}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="h-7 w-7 rounded-md hover:bg-accent grid place-items-center">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={onDelete} className="h-7 w-7 rounded-md hover:bg-destructive/10 grid place-items-center">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
      </div>
      <div className="text-sm font-medium mb-1.5">{insight.keyIdea}</div>
      {insight.insights.length > 0 && (
        <ul className="space-y-0.5 mb-1.5">
          {insight.insights.filter(Boolean).map((item, i) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
      {insight.mistakes && (
        <div className="text-xs text-destructive/80 bg-destructive/5 rounded-md px-2 py-1 mt-1">
          Mistake: {insight.mistakes}
        </div>
      )}
    </div>
  );
}
