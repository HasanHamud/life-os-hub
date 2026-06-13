import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney, budgetSpent, categoryPath } from "@/core/finance-utils";
import type { Budget, BudgetPeriod } from "@/core/finance-types";

export const Route = createFileRoute("/finance/budgets")({
  head: () => ({ meta: [{ title: "Budgets — Finance" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const { budgets, categories, transactions, settings, upsertBudget, deleteBudget } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const currency = settings.baseCurrency;

  return (
    <PageContainer>
      <PageHeader
        title="Budgets"
        description="Set spending limits per category and track utilization."
        actions={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add budget</Button>}
      />

      {budgets.length === 0 && (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No budgets yet. Create one to start tracking limits.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const spent = budgetSpent(b, transactions, categories);
          const pct = b.limitAmount ? Math.round((spent / b.limitAmount) * 100) : 0;
          const over = spent > b.limitAmount;
          return (
            <div key={b.id} className="rounded-xl border bg-card p-4 group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 rounded-full" style={{ background: cat?.color ?? "#888" }} />
                  <div className="text-sm font-semibold truncate">{cat?.name ?? "—"}</div>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={async () => {
                    await deleteBudget(b.id);
                    toast.success("Budget deleted");
                  }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="tabular-nums">{fmtMoney(spent, currency)} <span className="text-muted-foreground">/ {fmtMoney(b.limitAmount, currency)}</span></span>
                <span className={over ? "text-destructive font-medium" : "text-muted-foreground"}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={over ? "h-full bg-destructive" : "h-full"} style={{ width: `${Math.min(100, pct)}%`, background: over ? undefined : (cat?.color ?? "var(--primary)") }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 capitalize">{b.period}</div>
              {over && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Over budget by {fmtMoney(spent - b.limitAmount, currency)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BudgetDialog
        open={open}
        onOpenChange={setOpen}
        budget={editing}
        onSubmit={upsertBudget}
        categories={categories}
        onClose={() => setOpen(false)}
      />
    </PageContainer>
  );
}

function BudgetDialog({
  open, onOpenChange, budget, onSubmit, categories, onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  budget: Budget | null;
  onSubmit: (b: Partial<Budget>) => Promise<Budget>;
  categories: any[];
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");

  useEffect(() => {
    if (open && budget) {
      setCategoryId(budget.categoryId);
      setLimit(String(budget.limitAmount));
      setPeriod(budget.period);
    } else if (!open) {
      reset();
    }
  }, [open, budget]);

  const reset = () => { setCategoryId(""); setLimit(""); setPeriod("monthly"); };

  const submit = async () => {
    if (!categoryId) return toast.error("Pick a category");
    const lim = Number(limit);
    if (!lim || lim <= 0) return toast.error("Enter a valid limit");
    const isNew = !budget;
    await onSubmit({ id: budget?.id, categoryId, limitAmount: lim, period });
    toast.success(isNew ? "Budget added" : "Budget updated");
    reset(); onClose();
  };

  const expenseCats = categories.filter((c) => c.type === "expense");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{budget ? "Edit budget" : "New budget"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{categoryPath(c, categories)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Limit</Label>
              <Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as BudgetPeriod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={submit}>{budget ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}