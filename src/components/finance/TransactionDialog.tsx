import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/core/store";
import type { TxType, FinanceRecurrenceFreq } from "@/core/finance-types";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { categoryPath, convertCurrency, fmtMoney } from "@/core/finance-utils";

const TYPES: TxType[] = ["expense", "income", "transfer"];
const FREQS: FinanceRecurrenceFreq[] = ["none", "daily", "weekly", "monthly", "yearly"];

export function TransactionDialog({
  open, onOpenChange, transactionId, defaultType, defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId?: string | null;
  defaultType?: TxType;
  defaultAccountId?: string;
}) {
  const { transactions, accounts, categories, tasks, goals, settings, upsertTransaction, deleteTransaction } = useStore();
  const existing = transactionId ? transactions.find((t) => t.id === transactionId) : undefined;

  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [date, setDate] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [relatedTaskId, setRelatedTaskId] = useState<string>("none");
  const [relatedGoalId, setRelatedGoalId] = useState<string>("none");
  const [recFreq, setRecFreq] = useState<FinanceRecurrenceFreq>("none");

  useEffect(() => {
    if (!open) return;
    setType(existing?.type ?? defaultType ?? "expense");
    setAmount(existing?.amount ? String(existing.amount) : "");
    setAccountId(existing?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "");
    setToAccountId(existing?.toAccountId ?? "");
    setCategoryId(existing?.categoryId ?? "none");
    setDate(format(existing?.date ?? Date.now(), "yyyy-MM-dd'T'HH:mm"));
    setNote(existing?.note ?? "");
    setRelatedTaskId(existing?.relatedTaskId ?? "none");
    setRelatedGoalId(existing?.relatedGoalId ?? "none");
    setRecFreq(existing?.recurrence?.freq ?? "none");
  }, [open, existing, defaultType, defaultAccountId, accounts]);

  const filteredCats = categories.filter((c) => (type === "transfer" ? false : c.type === type));

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!accountId) {
      toast.error("Select an account");
      return;
    }
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
      toast.error("Select a different destination account");
      return;
    }
    const isNew = !existing;
    await upsertTransaction({
      id: existing?.id,
      type,
      amount: amt,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      categoryId: type === "transfer" || categoryId === "none" ? undefined : categoryId,
      date: date ? new Date(date).getTime() : Date.now(),
      note: note.trim() || undefined,
      relatedTaskId: relatedTaskId === "none" ? undefined : relatedTaskId,
      relatedGoalId: relatedGoalId === "none" ? undefined : relatedGoalId,
      recurrence: recFreq === "none" ? undefined : { freq: recFreq },
    });
    toast.success(isNew ? "Transaction added" : "Transaction updated", {
      description: `${type === "expense" ? "−" : type === "income" ? "+" : "↔"} ${amt.toFixed(2)}`,
    });
    onOpenChange(false);
  };

  const remove = async () => {
    if (!existing) return;
    await deleteTransaction(existing.id);
    toast.success("Transaction deleted");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit transaction" : "New transaction"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-md border text-xs font-medium capitalize transition-colors ${
                  type === t
                    ? t === "expense" ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : t === "income" ? "border-success/50 bg-success/10 text-success"
                    : "border-info/50 bg-info/10 text-info"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >{t}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Amount</Label>
              <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs">{type === "transfer" ? "From account" : "Account"}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {type === "transfer" ? (
              <div>
                <Label className="text-xs">To account</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.id !== accountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">— None —</SelectItem>
                    {filteredCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                          {categoryPath(c, categories)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Linked task</Label>
              <Select value={relatedTaskId} onValueChange={setRelatedTaskId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">— None —</SelectItem>
                  {tasks.slice(0, 100).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Linked goal</Label>
              <Select value={relatedGoalId} onValueChange={setRelatedGoalId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Recurrence</Label>
            <Select value={recFreq} onValueChange={(v) => setRecFreq(v as FinanceRecurrenceFreq)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-2">
          {existing && (
            <Button variant="ghost" onClick={remove} className="mr-auto text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{existing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
