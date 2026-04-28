import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, convertCurrency } from "@/core/finance-utils";
import type { SavingsGoal } from "@/core/finance-types";
import { format, differenceInDays } from "date-fns";

export const Route = createFileRoute("/finance/savings")({
  head: () => ({ meta: [{ title: "Savings — Finance" }] }),
  component: SavingsPage,
});

function SavingsPage() {
  const { savingsGoals, goals, settings, upsertSavingsGoal, deleteSavingsGoal } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const base = settings.baseCurrency;

  const totalSavedBase = savingsGoals.reduce(
    (a, g) => a + convertCurrency(g.currentAmount, g.currency ?? "USD", base, settings.usdToLbpRate),
    0,
  );
  const totalTargetBase = savingsGoals.reduce(
    (a, g) => a + convertCurrency(g.targetAmount, g.currency ?? "USD", base, settings.usdToLbpRate),
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        title="Savings goals"
        description="Track progress toward financial milestones."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add goal</Button>}
      />

      <div className="rounded-xl border bg-card p-4 mb-4 flex items-center gap-4">
        <PiggyBank className="h-8 w-8 text-warning" />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">
            Total saved <span className="opacity-70">(in {base} @ 1 USD = {settings.usdToLbpRate.toLocaleString()} LBP)</span>
          </div>
          <div className="text-2xl font-display font-semibold tabular-nums">
            {fmtMoney(totalSavedBase, base)} <span className="text-sm text-muted-foreground">/ {fmtMoney(totalTargetBase, base)}</span>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {savingsGoals.map((g) => {
          const cur = g.currency ?? "USD";
          const pct = g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
          const days = g.deadline ? differenceInDays(g.deadline, new Date()) : null;
          const linkedGoal = g.linkedGoalId ? goals.find((x) => x.id === g.linkedGoalId) : null;
          return (
            <div key={g.id} className="rounded-xl border bg-card p-4 group">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{g.title}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{cur}</div>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(g); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => {
                    await deleteSavingsGoal(g.id);
                    toast.success("Savings goal deleted");
                  }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
              <div className="text-2xl font-display font-semibold tabular-nums">{fmtMoney(g.currentAmount, cur)}</div>
              {cur !== base && (
                <div className="text-[11px] text-muted-foreground tabular-nums mb-2">
                  ≈ {fmtMoney(convertCurrency(g.currentAmount, cur, base, settings.usdToLbpRate), base)}
                </div>
              )}
              {cur === base && <div className="mb-2" />}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full" style={{ width: `${pct}%`, background: g.color ?? "var(--success)" }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                <span>{pct}% of {fmtMoney(g.targetAmount, cur)}</span>
                {g.deadline && <span>{days! >= 0 ? `${days}d left` : `${-days!}d overdue`}</span>}
              </div>
              {linkedGoal && <div className="text-[10px] text-primary mt-2">↳ {linkedGoal.title}</div>}
            </div>
          );
        })}
      </div>

      <SavingsDialog open={open} onOpenChange={setOpen} goal={editing} onSubmit={upsertSavingsGoal} onClose={() => setOpen(false)} />
    </PageContainer>
  );
}

function SavingsDialog({
  open, onOpenChange, goal, onSubmit, onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal: SavingsGoal | null;
  onSubmit: (g: Partial<SavingsGoal>) => Promise<SavingsGoal>;
  onClose: () => void;
}) {
  const { goals } = useStore();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [currency, setCurrency] = useState<string>("USD");
  const [deadline, setDeadline] = useState("");
  const [linkedGoalId, setLinkedGoalId] = useState("none");
  const [color, setColor] = useState("#90b890");

  if (open && goal && title === "" && goal.title) {
    setTitle(goal.title);
    setTarget(String(goal.targetAmount));
    setCurrent(String(goal.currentAmount));
    setCurrency(goal.currency ?? "USD");
    setDeadline(goal.deadline ? format(goal.deadline, "yyyy-MM-dd") : "");
    setLinkedGoalId(goal.linkedGoalId ?? "none");
    setColor(goal.color ?? "#90b890");
  }

  const reset = () => { setTitle(""); setTarget(""); setCurrent("0"); setCurrency("USD"); setDeadline(""); setLinkedGoalId("none"); setColor("#90b890"); };

  const submit = async () => {
    if (!title.trim()) return toast.error("Title required");
    const t = Number(target);
    if (!t || t <= 0) return toast.error("Target must be > 0");
    const isNew = !goal;
    await onSubmit({
      id: goal?.id,
      title: title.trim(),
      targetAmount: t,
      currentAmount: Number(current) || 0,
      currency,
      deadline: deadline ? new Date(deadline).getTime() : undefined,
      linkedGoalId: linkedGoalId === "none" ? undefined : linkedGoalId,
      color,
    });
    toast.success(isNew ? "Savings goal added" : "Savings goal updated");
    reset(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{goal ? "Edit savings goal" : "New savings goal"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="LBP">LBP — Lebanese Lira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Target amount ({currency})</Label>
              <Input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Current amount ({currency})</Label>
              <Input type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Link to life goal</Label>
            <Select value={linkedGoalId} onValueChange={setLinkedGoalId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}>{goal ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
