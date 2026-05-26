import { Trash2, Pencil, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Problem } from "@/core/learn-types";

const DIFF_COLORS = ["", "bg-green-500", "bg-yellow-500", "bg-orange-500", "bg-red-500", "bg-red-600"];

export function ProblemCard({
  problem,
  onEdit,
  onDelete,
  onToggle,
}: {
  problem: Problem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 group hover:border-primary/30 transition-colors",
      problem.completed && "opacity-60",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <button onClick={onToggle} className="mt-0.5 shrink-0">
            {problem.completed
              ? <CheckCircle2 className="h-4 w-4 text-success" />
              : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            }
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{problem.title}</div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-[10px] text-muted-foreground">{problem.subject}</span>
              {problem.patternClass && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {problem.patternClass}
                </span>
              )}
              {problem.source && (
                <span className="text-[10px] text-muted-foreground">{problem.source}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= problem.difficulty ? DIFF_COLORS[problem.difficulty] : "bg-muted")} />
                ))}
              </div>
              {problem.timeToSolve && (
                <span className="text-[10px] text-muted-foreground">{problem.timeToSolve}m</span>
              )}
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
    </div>
  );
}
