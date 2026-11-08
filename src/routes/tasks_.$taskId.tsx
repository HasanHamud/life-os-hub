import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { useStore } from "@/core/store";
import { personName, usePeople } from "@/core/people";
import type { TaskStatus, Priority, RecurrenceFreq } from "@/core/types";
import { format } from "date-fns";
import { formatWhen } from "@/core/utils";
import { ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/core/i18n";

const STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "blocked", "done"];
const PRIORITIES: Priority[] = ["low", "med", "high", "urgent"];
const FREQS: RecurrenceFreq[] = ["none", "daily", "weekly", "custom"];
const WEEKDAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];

function isStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}

export const Route = createFileRoute("/tasks_/$taskId")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: isStatus(search.status) ? search.status : undefined,
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  head: () => ({ meta: [{ title: i18n.t("meta.task") }] }),
  component: TaskPage,
});

function TaskPage() {
  const { t } = useTranslation();
  const { taskId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const isNew = taskId === "new";
  const { tasks, projects, goals, tags, loaded, upsertTask, deleteTask, setTaskStatus } = useStore();
  const people = usePeople();
  const existing = isNew ? undefined : tasks.find((t) => t.id === taskId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<Priority>("med");
  const [effort, setEffort] = useState("");
  const [deadline, setDeadline] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [goalId, setGoalId] = useState("none");
  const [parentTaskId, setParentTaskId] = useState("none");
  const [assigneeId, setAssigneeId] = useState("none");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [recFreq, setRecFreq] = useState<RecurrenceFreq>("none");
  const [recDays, setRecDays] = useState<number[]>([]);
  const [recInterval, setRecInterval] = useState("2");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const subtasks = existing ? tasks.filter((t) => t.parentTaskId === existing.id) : [];
  const selectedProject = projects.find((p) => p.id === projectId);
  const manager = personName(people, selectedProject?.managerId);

  useEffect(() => {
    if (!loaded) return;
    if (!isNew && !existing) return;
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setStatus(existing?.status ?? search.status ?? "todo");
    setPriority(existing?.priority ?? "med");
    setEffort(existing?.effort ? String(existing.effort) : "");
    setDeadline(existing?.deadline ? format(existing.deadline, "yyyy-MM-dd'T'HH:mm") : "");
    setProjectId(existing?.projectId ?? search.projectId ?? "none");
    setGoalId(existing?.goalId ?? "none");
    setParentTaskId(existing?.parentTaskId ?? "none");
    setAssigneeId(existing?.assigneeId ?? "none");
    setTagIds(existing?.tagIds ?? []);
    setDependsOnIds(existing?.dependsOnIds ?? []);
    setRecFreq(existing?.recurrence?.freq ?? "none");
    setRecDays(existing?.recurrence?.weekdays ?? []);
    setRecInterval(existing?.recurrence?.intervalDays ? String(existing.recurrence.intervalDays) : "2");
    // Seed once per task. Later store updates (subtasks, archive) must not wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, taskId]);

  const addSubtask = async () => {
    if (!existing) {
      toast.error(t("tasks.saveFirstSub"));
      return;
    }
    const subTitle = newSubtaskTitle.trim();
    if (!subTitle) return;
    await upsertTask({
      title: subTitle,
      status: "todo",
      priority: "med",
      parentTaskId: existing.id,
      projectId: existing.projectId,
      goalId: existing.goalId,
      tagIds: [],
    });
    setNewSubtaskTitle("");
    toast.success(t("tasks.subAdded"));
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error(t("errors.titleRequired"));
      return;
    }
    const task = await upsertTask({
      id: existing?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      status, priority,
      effort: effort ? Number(effort) : undefined,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      projectId: projectId === "none" ? null : projectId,
      goalId: goalId === "none" ? undefined : goalId,
      parentTaskId: parentTaskId === "none" ? undefined : parentTaskId,
      assigneeId: assigneeId === "none" ? null : assigneeId,
      tagIds, dependsOnIds,
      recurrence: recFreq === "none" ? undefined : {
        freq: recFreq,
        weekdays: recFreq === "weekly" ? recDays : undefined,
        intervalDays: recFreq === "custom" ? Number(recInterval) || 2 : undefined,
      },
    });
    toast.success(isNew ? t("tasks.created") : t("tasks.updated"), { description: title.trim() });
    if (isNew) {
      navigate({ to: "/tasks/$taskId", params: { taskId: task.id }, replace: true });
    }
  };

  const remove = async () => {
    if (!existing) return;
    await deleteTask(existing.id);
    toast.success(t("tasks.deleted"));
    navigate({ to: "/tasks" });
  };

  const possibleParents = tasks.filter((t) => t.id !== existing?.id && !t.parentTaskId);
  const possibleDeps = tasks.filter((t) => t.id !== existing?.id);

  if (loaded && !isNew && !existing) {
    return (
      <PageContainer>
        <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t("nav.tasks")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("tasks.missing")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t("nav.tasks")}
      </Link>
      <PageHeader
        className="flex-wrap"
        title={existing ? t("tasks.edit") : t("tasks.newTask")}
        description={t("tasks.details")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {existing && (
              <Button variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 me-1" /> {t("common.delete")}
              </Button>
            )}
            {existing && (
              <Button
                variant="outline"
                onClick={async () => {
                  await upsertTask({ id: existing.id, archived: !existing.archived });
                  toast.success(existing.archived ? t("tasks.unarchived") : t("tasks.archived"));
                }}
              >
                {existing.archived ? t("common.unarchive") : t("common.archive")}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate({ to: "/tasks" })}>{t("common.back")}</Button>
            <Button onClick={submit}>{existing ? t("common.save") : t("common.create")}</Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 lg:h-full">
          <div>
            <Label className="text-xs">{t("common.title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("tasks.what")} autoFocus />
          </div>
          <div className="flex flex-1 flex-col">
            <Label className="text-xs">{t("common.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("tasks.context")} className="min-h-40 flex-1" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{t("common.status")}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("common.priority")}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("tasks.effort")}</Label>
            <Input type="number" min={0} value={effort} onChange={(e) => setEffort(e.target.value)} placeholder={t("tasks.effortPh")} />
          </div>
          <div>
            <Label className="text-xs">{t("tasks.deadline")}</Label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            {deadline && !Number.isNaN(new Date(deadline).getTime()) && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {formatWhen(new Date(deadline), "EEEE, MMM d, HH:mm")}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">{t("common.project")}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedProject?.managerId && (
              <p className="text-[11px] text-muted-foreground mt-1">{t("tasks.manager", { name: manager || t("common.unknown") })}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">{t("tasks.assign")}</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder={t("tasks.unassigned")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tasks.unassigned")}</SelectItem>
                {assigneeId !== "none" && !people.some((p) => p.id === assigneeId) && (
                  <SelectItem value={assigneeId}>{t("tasks.unknownUser")}</SelectItem>
                )}
                {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("common.goal")}</Label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">{t("tasks.parent")}</Label>
            <Select value={parentTaskId} onValueChange={setParentTaskId}>
              <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.none")}</SelectItem>
                {possibleParents.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <Label className="text-xs">
            {t("tasks.subtasks")} {subtasks.length > 0 && (
              <span className="text-muted-foreground ml-1 tabular-nums">
                {subtasks.filter((s) => s.status === "done").length}/{subtasks.length}
              </span>
            )}
          </Label>
          {!existing && (
            <p className="text-[11px] text-muted-foreground mt-2">{t("tasks.saveFirst")}</p>
          )}
          {existing && subtasks.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-2 mb-2">{t("tasks.noSubtasks")}</p>
          )}
          {existing && subtasks.length > 0 && (
            <div className="space-y-1 my-2">
              {subtasks.map((s) => {
                const done = s.status === "done";
                return (
                  <div key={s.id} className="flex items-center gap-2 group/sub py-1">
                    <button
                      type="button"
                      onClick={() => setTaskStatus(s.id, done ? "todo" : "done")}
                      className={cn(
                        "h-4 w-4 rounded-sm border flex items-center justify-center shrink-0",
                        done ? "bg-success border-success" : "border-muted-foreground/40 hover:border-foreground",
                      )}
                    >
                      {done && <span className="text-[10px] text-background leading-none">✓</span>}
                    </button>
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: s.id }}
                      className={cn("text-sm flex-1 truncate hover:underline", done && "line-through text-muted-foreground")}
                    >
                      {s.title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => deleteTask(s.id).then(() => toast.success(t("tasks.subDeleted")))}
                      className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive p-1"
                      aria-label={t("tasks.deleteSubtask")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {existing && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                placeholder={t("tasks.addSubtask")}
                className="h-8 text-sm"
              />
              <Button type="button" size="sm" onClick={addSubtask} disabled={!newSubtaskTitle.trim()}>{t("common.add")}</Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
          <Label className="text-xs">{t("common.tags")}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tags.length === 0 && <span className="text-xs text-muted-foreground">{t("tasks.noTags")}</span>}
            {tags.map((tag) => {
              const on = tagIds.includes(tag.id);
              return (
                <button key={tag.id} type="button"
                  onClick={() => setTagIds(on ? tagIds.filter((x) => x !== tag.id) : [...tagIds, tag.id])}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs border transition-colors",
                    on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                  style={on ? { borderColor: tag.color, boxShadow: `inset 0 0 0 1px ${tag.color}40` } : undefined}
                >#{tag.name}</button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs">{t("tasks.depends")}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1 max-h-32 overflow-y-auto scrollbar-thin">
            {possibleDeps.length === 0 && <span className="text-xs text-muted-foreground">{t("tasks.noOther")}</span>}
            {possibleDeps.slice(0, 30).map((task) => {
              const on = dependsOnIds.includes(task.id);
              return (
                <button key={task.id} type="button"
                  onClick={() => setDependsOnIds(on ? dependsOnIds.filter((x) => x !== task.id) : [...dependsOnIds, task.id])}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs border",
                    on ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground",
                  )}>
                  {task.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <Label className="text-xs">{t("tasks.recurrence")}</Label>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Select value={recFreq} onValueChange={(v) => setRecFreq(v as RecurrenceFreq)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQS.map((f) => <SelectItem key={f} value={f}>{t(`freq.${f}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            {recFreq === "weekly" && (
              <div className="flex gap-1">
                {WEEKDAY_INDEXES.map((i) => {
                  const on = recDays.includes(i);
                  return (
                    <button key={i} type="button"
                      onClick={() => setRecDays(on ? recDays.filter((x) => x !== i) : [...recDays, i])}
                      className={cn(
                        "h-7 w-7 rounded text-xs",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                      )}>{t(`week.d${i}`)}</button>
                  );
                })}
              </div>
            )}
            {recFreq === "custom" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("tasks.every")}</span>
                <Input type="number" min={1} value={recInterval} onChange={(e) => setRecInterval(e.target.value)} className="w-20" />
                <span className="text-xs text-muted-foreground">{t("tasks.days")}</span>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </PageContainer>
  );
}
