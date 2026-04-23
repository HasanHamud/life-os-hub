import { cn } from "@/lib/utils";
import type { TaskStatus, Priority } from "@/core/types";

const STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: "bg-status-backlog/15 text-status-backlog border-status-backlog/30",
  todo: "bg-status-todo/15 text-status-todo border-status-todo/30",
  in_progress: "bg-status-progress/15 text-status-progress border-status-progress/30",
  blocked: "bg-status-blocked/15 text-status-blocked border-status-blocked/30",
  done: "bg-status-done/15 text-status-done border-status-done/30",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-priority-low/15 text-priority-low border-priority-low/30",
  med: "bg-priority-med/15 text-priority-med border-priority-med/30",
  high: "bg-priority-high/15 text-priority-high border-priority-high/30",
  urgent: "bg-priority-urgent/15 text-priority-urgent border-priority-urgent/30",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress", blocked: "Blocked", done: "Done",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
      STATUS_STYLES[status], className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
      PRIORITY_STYLES[priority], className,
    )}>
      {priority}
    </span>
  );
}
