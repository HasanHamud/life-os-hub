import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { goalProgress, fmt } from "@/core/utils";
import { differenceInDays, addDays, format } from "date-fns";
import { Plus, Target, Trash2 } from "lucide-react";
import { TaskRow } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";

export const Route = createFileRoute("/goals")({
  head: () => ({ meta: [
    { title: "Goals — Life OS" },
    { name: "description", content: "30/60/90 day goals with linked tasks and progress tracking." },
  ]}),
  component: GoalsPage,
});

function GoalsPage() {
  const { goals, tasks, sessions, upsertGoal, deleteGoal } = useStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const open = openId ? goals.find((g) => g.id === openId) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Goals"
        description="Set time-boxed goals. Link tasks. Watch progress build."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />New Goal</Button>}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {goals.map((g) => {
          const pct = goalProgress(g, tasks);
          const linked = tasks.filter((t) => t.goalId === g.id);
          const minutes = sessions.filter((s) => linked.some((t) => t.id === s.taskId)).reduce((a, s) => a + s.duration / 60, 0);
          const daysLeft = Math.max(0, differenceInDays(g.endDate, new Date()));
          return (
            <div key={g.id} onClick={() => setOpenId(g.id)}
              className="rounded-xl border bg-card p-5 cursor-pointer hover:border-primary/40 transition-all hover:shadow-soft">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">{g.title}</div>
                    <div className="text-[11px] text-muted-foreground">{g.durationDays}-day goal · {daysLeft}d left</div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditing(g.id); }}
                  className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
              </div>
              {g.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{g.description}</p>}
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">{linked.filter((t) => t.status === "done").length}/{linked.length} tasks · {fmt.duration(minutes)} focus</span>
                <span className="tabular-nums font-medium">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-warning transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 tabular-nums">
                {fmt.date(g.startDate)} → {fmt.date(g.endDate)}
              </div>
            </div>
          );
        })}
        {goals.length === 0 && <div className="col-span-full text-center py-16 text-sm text-muted-foreground">No goals yet.</div>}
      </div>

      <GoalDialog open={creating || !!editing}
        goalId={editing}
        onOpenChange={(v) => { if (!v) { setCreating(false); setEditing(null); } }}
        onSubmit={async (d) => { await upsertGoal({ id: editing ?? undefined, ...d }); setCreating(false); setEditing(null); }}
        onDelete={editing ? async () => { await deleteGoal(editing); setEditing(null); } : undefined}
      />

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader><DialogTitle>{open.title}</DialogTitle></DialogHeader>
              {open.description && <p className="text-sm text-muted-foreground">{open.description}</p>}
              <div className="text-xs text-muted-foreground mb-2">
                {fmt.date(open.startDate)} → {fmt.date(open.endDate)} · {open.durationDays} days
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
                <div className="h-full bg-gradient-to-r from-primary to-warning" style={{ width: `${goalProgress(open, tasks)}%` }} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Linked tasks</div>
              <div className="space-y-1">
                {tasks.filter((t) => t.goalId === open.id).map((t) => (
                  <TaskRow key={t.id} task={t} onClick={() => setEditTaskId(t.id)} />
                ))}
                {tasks.filter((t) => t.goalId === open.id).length === 0 && (
                  <div className="text-xs text-muted-foreground py-3 text-center">
                    No tasks linked. Set a task's goal in the task editor.
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TaskDialog open={!!editTaskId} onOpenChange={(v) => !v && setEditTaskId(null)} taskId={editTaskId} />
    </PageContainer>
  );
}

function GoalDialog({
  open, onOpenChange, goalId, onSubmit, onDelete,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; goalId: string | null;
  onSubmit: (d: { title: string; description?: string; durationDays: number; startDate: number; endDate: number }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const goal = useStore((s) => goalId ? s.goals.find((g) => g.id === goalId) : undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [start, setStart] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setDuration(String(goal?.durationDays ?? 30));
    setStart(format(goal?.startDate ?? new Date(), "yyyy-MM-dd"));
  }, [open, goal]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{goalId ? "Edit Goal" : "New Goal"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
          <div><Label className="text-xs">Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {onDelete && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            const startTs = new Date(start).getTime();
            const dur = Number(duration) || 30;
            await onSubmit({ title, description, durationDays: dur, startDate: startTs, endDate: addDays(startTs, dur).getTime() });
          }}>{goalId ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
