import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import type { TaskStatus } from "@/core/types";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Life OS" },
      { name: "description", content: "Kanban board with backlog, todo, in progress, blocked and done columns." },
    ],
  }),
  component: TasksPage,
});

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

function TasksPage() {
  const { tasks, tags, projects, setTaskStatus } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<TaskStatus | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (t.parentTaskId) return false; // show subtasks under parents in detail
      if (!showArchived && t.archived) return false;
      if (showArchived && !t.archived) return false;
      if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (tagFilter.length && !tagFilter.every((id) => t.tagIds.includes(id))) return false;
      if (projectFilter && t.projectId !== projectFilter) return false;
      return true;
    });
  }, [tasks, query, tagFilter, projectFilter, showArchived]);

  const byStatus = (status: TaskStatus) => filtered.filter((t) => t.status === status);

  const onDrop = async (status: TaskStatus) => {
    if (dragId) {
      await setTaskStatus(dragId, status);
      setDragId(null);
      setDragOver(null);
    }
  };

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Tasks"
        description="Drag cards across columns. Click any card to edit details, subtasks, dependencies and recurrence."
        actions={<Button onClick={() => setCreatingFor("todo")}><Plus className="h-4 w-4 mr-1" /> New Task</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="pl-8" />
        </div>
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9 rounded-md border bg-input px-3 text-sm">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => {
            const on = tagFilter.includes(t.id);
            return (
              <button key={t.id}
                onClick={() => setTagFilter(on ? tagFilter.filter((x) => x !== t.id) : [...tagFilter, t.id])}
                className={cn("text-[11px] px-2 py-1 rounded border transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
                style={on ? { borderColor: t.color } : undefined}>
                #{t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const items = byStatus(col.id);
          return (
            <div key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => onDrop(col.id)}
              className={cn(
                "rounded-xl bg-surface/50 border border-transparent p-2 min-h-[60vh] transition-colors",
                dragOver === col.id && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", `bg-status-${col.id === "in_progress" ? "progress" : col.id}`)} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{items.length}</span>
                </div>
                <button onClick={() => setCreatingFor(col.id)}
                  className="h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <TaskCard key={t.id} task={t}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => setOpenId(t.id)} />
                ))}
                {items.length === 0 && <div className="text-center text-[11px] text-muted-foreground py-6">Drop tasks here</div>}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} taskId={openId} />
      <TaskDialog open={!!creatingFor} onOpenChange={(v) => !v && setCreatingFor(null)} defaultStatus={creatingFor ?? undefined} />
    </PageContainer>
  );
}
