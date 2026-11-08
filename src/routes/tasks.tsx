import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskCard } from "@/components/tasks/TaskCard";
import type { TaskStatus } from "@/core/types";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: i18n.t("meta.tasks") },
      { name: "description", content: i18n.t("meta.tasksDesc") },
    ],
  }),
  component: TasksPage,
});

const COLUMNS: TaskStatus[] = ["backlog", "todo", "in_progress", "blocked", "done"];

function TasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, tags, projects, setTaskStatus } = useStore();
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const allCategories = useMemo(
    () => Array.from(new Set(projects.map((p) => p.category).filter(Boolean) as string[])),
    [projects],
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (t.parentTaskId) return false;
      if (!showArchived && t.archived) return false;
      if (showArchived && !t.archived) return false;
      if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (tagFilter.length && !tagFilter.every((id) => t.tagIds.includes(id))) return false;
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (categoryFilter) {
        const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : undefined;
        if (!proj || (proj.category ?? "") !== categoryFilter) return false;
      }
      return true;
    });
  }, [tasks, query, tagFilter, projectFilter, showArchived, categoryFilter, projects]);

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
        title={t("tasks.title")}
        description={t("tasks.description")}
        actions={
          <Button onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: "new" }, search: { status: "todo" } })}>
            <Plus className="h-4 w-4 me-1" /> {t("tasks.new")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("tasks.search")} className="ps-8" />
        </div>
        <Select value={projectFilter || "__all__"} onValueChange={(v) => setProjectFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("tasks.allProjects")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("tasks.allProjects")}</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter || "__all__"} onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("tasks.allCategories")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("tasks.allCategories")}</SelectItem>
            {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const on = tagFilter.includes(tag.id);
            return (
              <button key={tag.id}
                onClick={() => setTagFilter(on ? tagFilter.filter((x) => x !== tag.id) : [...tagFilter, tag.id])}
                className={cn("text-[11px] px-2 py-1 rounded border transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
                style={on ? { borderColor: tag.color } : undefined}>
                #{tag.name}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "text-[11px] px-2 py-1 rounded border transition-colors",
            showArchived ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {showArchived ? t("tasks.showingArchived") : t("tasks.showArchived")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const items = byStatus(col);
          return (
            <div key={col}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => onDrop(col)}
              className={cn(
                "rounded-xl bg-surface/50 border border-transparent p-2 min-h-[60vh] transition-colors",
                dragOver === col && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", `bg-status-${col === "in_progress" ? "progress" : col}`)} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`status.${col}`)}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{items.length}</span>
                </div>
                <button onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: "new" }, search: { status: col } })}
                  className="h-6 w-6 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {items.map((task) => (
                  <TaskCard key={task.id} task={task}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: task.id } })} />
                ))}
                {items.length === 0 && <div className="text-center text-[11px] text-muted-foreground py-6">{t("tasks.drop")}</div>}
              </div>
            </div>
          );
        })}
      </div>

    </PageContainer>
  );
}