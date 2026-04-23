import { useStore } from "@/core/store";
import type { Task } from "@/core/types";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { fmt, isOverdue } from "@/core/utils";
import { Calendar, Link2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskCard({
  task, onClick, draggable = false, onDragStart,
}: {
  task: Task;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const { tags, projects, tasks } = useStore();
  const taskTags = tags.filter((t) => task.tagIds.includes(t.id));
  const project = projects.find((p) => p.id === task.projectId);
  const subtaskCount = tasks.filter((t) => t.parentTaskId === task.id).length;
  const subtaskDone = tasks.filter((t) => t.parentTaskId === task.id && t.status === "done").length;
  const overdue = isOverdue(task);
  const blockedByDep = (task.dependsOnIds ?? []).some(
    (id) => tasks.find((t) => t.id === id)?.status !== "done"
  );

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "group rounded-lg border bg-card hover:bg-surface-elevated p-3 cursor-pointer transition-all",
        "hover:border-primary/40 hover:shadow-soft",
        draggable && "active:opacity-50",
        overdue && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-sm font-medium leading-snug text-foreground line-clamp-2">{task.title}</div>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
      )}

      {(taskTags.length > 0 || project) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {project && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {project.name}
            </span>
          )}
          {taskTags.map((t) => (
            <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${t.color}20`, color: t.color }}>
              #{t.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.deadline && (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
              <Calendar className="h-3 w-3" />
              {fmt.date(task.deadline)}
            </span>
          )}
          {task.effort && <span>· {fmt.duration(task.effort)}</span>}
          {subtaskCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {subtaskDone}/{subtaskCount}
            </span>
          )}
        </div>
        {blockedByDep && (
          <span title="Blocked by dependency" className="text-warning">
            <AlertCircle className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function TaskRow({ task, onClick }: { task: Task; onClick?: () => void }) {
  const setStatus = useStore((s) => s.setTaskStatus);
  const done = task.status === "done";
  return (
    <div className="group flex items-center gap-3 py-2 px-3 rounded-md hover:bg-surface-elevated transition-colors">
      <button
        onClick={(e) => { e.stopPropagation(); setStatus(task.id, done ? "todo" : "done"); }}
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center shrink-0",
          done ? "bg-success border-success" : "border-muted-foreground/40 hover:border-foreground",
        )}
      >
        {done && <span className="text-[10px] text-background leading-none">✓</span>}
      </button>
      <button onClick={onClick} className="flex-1 min-w-0 text-left">
        <div className={cn("text-sm truncate", done && "line-through text-muted-foreground")}>
          {task.title}
        </div>
      </button>
      <div className="flex items-center gap-2 opacity-80">
        {task.deadline && (
          <span className={cn("text-[11px] text-muted-foreground", isOverdue(task) && "text-destructive")}>
            {fmt.date(task.deadline)}
          </span>
        )}
        <PriorityBadge priority={task.priority} />
        <StatusBadge status={task.status} />
      </div>
    </div>
  );
}
