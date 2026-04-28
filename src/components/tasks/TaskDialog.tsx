import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/core/store";
import type { Task, TaskStatus, Priority, RecurrenceFreq } from "@/core/types";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "blocked", "done"];
const PRIORITIES: Priority[] = ["low", "med", "high", "urgent"];
const FREQS: RecurrenceFreq[] = ["none", "daily", "weekly", "custom"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function TaskDialog({
  open, onOpenChange, taskId, defaultStatus,
}: { open: boolean; onOpenChange: (v: boolean) => void; taskId?: string | null; defaultStatus?: TaskStatus }) {
  const { tasks, projects, goals, tags, upsertTask, deleteTask, setTaskStatus } = useStore();
  const existing = taskId ? tasks.find((t) => t.id === taskId) : undefined;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<Priority>("med");
  const [effort, setEffort] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("none");
  const [goalId, setGoalId] = useState<string>("none");
  const [parentTaskId, setParentTaskId] = useState<string>("none");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [dependsOnIds, setDependsOnIds] = useState<string[]>([]);
  const [recFreq, setRecFreq] = useState<RecurrenceFreq>("none");
  const [recDays, setRecDays] = useState<number[]>([]);
  const [recInterval, setRecInterval] = useState<string>("2");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("");

  const subtasks = existing ? tasks.filter((t) => t.parentTaskId === existing.id) : [];

  const addSubtask = async () => {
    if (!existing) {
      toast.error("Save the task first to add subtasks");
      return;
    }
    const t = newSubtaskTitle.trim();
    if (!t) return;
    await upsertTask({
      title: t,
      status: "todo",
      priority: "med",
      parentTaskId: existing.id,
      projectId: existing.projectId,
      goalId: existing.goalId,
      tagIds: [],
    });
    setNewSubtaskTitle("");
    toast.success("Subtask added");
  };

  const toggleSubtask = async (subId: string, done: boolean) => {
    await setTaskStatus(subId, done ? "todo" : "done");
  };

  const removeSubtask = async (subId: string) => {
    await deleteTask(subId);
    toast.success("Subtask deleted");
  };

  useEffect(() => {
    if (!open) return;
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setStatus(existing?.status ?? defaultStatus ?? "todo");
    setPriority(existing?.priority ?? "med");
    setEffort(existing?.effort ? String(existing.effort) : "");
    setDeadline(existing?.deadline ? format(existing.deadline, "yyyy-MM-dd'T'HH:mm") : "");
    setProjectId(existing?.projectId ?? "none");
    setGoalId(existing?.goalId ?? "none");
    setParentTaskId(existing?.parentTaskId ?? "none");
    setTagIds(existing?.tagIds ?? []);
    setDependsOnIds(existing?.dependsOnIds ?? []);
    setRecFreq(existing?.recurrence?.freq ?? "none");
    setRecDays(existing?.recurrence?.weekdays ?? []);
    setRecInterval(existing?.recurrence?.intervalDays ? String(existing.recurrence.intervalDays) : "2");
  }, [open, existing, defaultStatus]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const isNew = !existing;
    await upsertTask({
      id: existing?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      status, priority,
      effort: effort ? Number(effort) : undefined,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      projectId: projectId === "none" ? undefined : projectId,
      goalId: goalId === "none" ? undefined : goalId,
      parentTaskId: parentTaskId === "none" ? undefined : parentTaskId,
      tagIds, dependsOnIds,
      recurrence: recFreq === "none" ? undefined : {
        freq: recFreq,
        weekdays: recFreq === "weekly" ? recDays : undefined,
        intervalDays: recFreq === "custom" ? Number(recInterval) || 2 : undefined,
      },
    });
    toast.success(isNew ? "Task created" : "Task updated", { description: title.trim() });
    onOpenChange(false);
  };

  const remove = async () => {
    if (existing) {
      await deleteTask(existing.id);
      toast.success("Task deleted");
      onOpenChange(false);
    }
  };

  const possibleParents = tasks.filter((t) => t.id !== existing?.id && !t.parentTaskId);
  const possibleDeps = tasks.filter((t) => t.id !== existing?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional context, notes, links…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Effort (minutes)</Label>
              <Input type="number" min={0} value={effort} onChange={(e) => setEffort(e.target.value)} placeholder="e.g. 60" />
            </div>
            <div>
              <Label className="text-xs">Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Goal</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Parent task (subtask of)</Label>
              <Select value={parentTaskId} onValueChange={setParentTaskId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {possibleParents.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subtasks */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">
                Subtasks {subtasks.length > 0 && (
                  <span className="text-muted-foreground ml-1 tabular-nums">
                    {subtasks.filter((s) => s.status === "done").length}/{subtasks.length}
                  </span>
                )}
              </Label>
            </div>
            {!existing && (
              <p className="text-[11px] text-muted-foreground">Save this task first to add subtasks.</p>
            )}
            {existing && subtasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground mb-2">No subtasks yet — break this task down below.</p>
            )}
            {existing && subtasks.length > 0 && (
              <div className="space-y-1 mb-2 max-h-40 overflow-y-auto scrollbar-thin">
                {subtasks.map((s) => {
                  const done = s.status === "done";
                  return (
                    <div key={s.id} className="flex items-center gap-2 group/sub py-1">
                      <button
                        type="button"
                        onClick={() => toggleSubtask(s.id, done)}
                        className={cn(
                          "h-4 w-4 rounded-sm border flex items-center justify-center shrink-0",
                          done ? "bg-success border-success" : "border-muted-foreground/40 hover:border-foreground",
                        )}
                      >
                        {done && <span className="text-[10px] text-background leading-none">✓</span>}
                      </button>
                      <span className={cn("text-sm flex-1 truncate", done && "line-through text-muted-foreground")}>{s.title}</span>
                      <button
                        type="button"
                        onClick={() => removeSubtask(s.id)}
                        className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive p-1"
                        aria-label="Delete subtask"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {existing && (
              <div className="flex gap-2">
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                  placeholder="Add subtask and press Enter"
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" onClick={addSubtask} disabled={!newSubtaskTitle.trim()}>Add</Button>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet — create some on the Tags page.</span>}
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() => setTagIds(on ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id])}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs border transition-colors",
                      on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    style={on ? { borderColor: t.color, boxShadow: `inset 0 0 0 1px ${t.color}40` } : undefined}
                  >#{t.name}</button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">Depends on</Label>
            <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto scrollbar-thin">
              {possibleDeps.length === 0 && <span className="text-xs text-muted-foreground">No other tasks.</span>}
              {possibleDeps.slice(0, 30).map((t) => {
                const on = dependsOnIds.includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() => setDependsOnIds(on ? dependsOnIds.filter((x) => x !== t.id) : [...dependsOnIds, t.id])}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs border",
                      on ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground",
                    )}>
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <Label className="text-xs">Recurrence</Label>
            <div className="flex items-center gap-2 mt-1">
              <Select value={recFreq} onValueChange={(v) => setRecFreq(v as RecurrenceFreq)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              {recFreq === "weekly" && (
                <div className="flex gap-1">
                  {WEEKDAYS.map((d, i) => {
                    const on = recDays.includes(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => setRecDays(on ? recDays.filter((x) => x !== i) : [...recDays, i])}
                        className={cn(
                          "h-7 w-7 rounded text-xs",
                          on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                        )}>{d}</button>
                    );
                  })}
                </div>
              )}
              {recFreq === "custom" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">every</span>
                  <Input type="number" min={1} value={recInterval} onChange={(e) => setRecInterval(e.target.value)} className="w-20" />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          {existing && (
            <Button variant="ghost" onClick={remove} className="mr-auto text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{existing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SubtaskItemProps { task: Task }
export function SubtaskRow({ task }: SubtaskItemProps) {
  const setStatus = useStore((s) => s.setTaskStatus);
  const done = task.status === "done";
  return (
    <button
      onClick={() => setStatus(task.id, done ? "todo" : "done")}
      className="flex items-center gap-2 text-left w-full text-xs py-1 group"
    >
      <span className={cn(
        "h-3.5 w-3.5 rounded-sm border flex items-center justify-center shrink-0",
        done ? "bg-success border-success" : "border-muted-foreground/40 group-hover:border-foreground",
      )}>
        {done && <span className="text-[10px] text-background leading-none">✓</span>}
      </span>
      <span className={cn("truncate", done && "line-through text-muted-foreground")}>{task.title}</span>
    </button>
  );
}
