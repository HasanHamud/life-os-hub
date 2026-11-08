import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

const TYPE_LABEL: Record<TxType, "finance.expense" | "finance.income" | "finance.transfer"> = {
  expense: "finance.expense",
  income: "finance.income",
  transfer: "finance.transfer",
};

export function TransactionDialog({
  open, onOpenChange, transactionId, defaultType, defaultAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId?: string | null;
  defaultType?: TxType;
  defaultAccountId?: string;
}) {
  const { t } = useTranslation();
  const { transactions, accounts, categories, tasks, goals, settings, upsertTransaction, deleteTransaction } = useStore();
  const existing = transactionId ? transactions.find((tx) => tx.id === transactionId) : undefined;

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
  const accountCurrency = accounts.find((a) => a.id === accountId)?.currency ?? "USD";
  const otherCurrency = accountCurrency === "USD" ? "LBP" : "USD";
  const amountNum = Number(amount) || 0;

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
            {TYPES.map((txType) => (
              <button
                key={txType}
                type="button"
                onClick={() => setType(txType)}
                className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                  type === txType
                    ? txType === "expense" ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : txType === "income" ? "border-success/50 bg-success/10 text-success"
                    : "border-info/50 bg-info/10 text-info"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >{t(TYPE_LABEL[txType])}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                Amount {accountCurrency && <span className="text-muted-foreground">({accountCurrency})</span>}
              </Label>
              <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
              {amountNum > 0 && accountCurrency && otherCurrency && (
                <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                  ≈ {fmtMoney(convertCurrency(amountNum, accountCurrency, otherCurrency, settings.usdToLbpRate), otherCurrency)}
                  <span className="opacity-60"> · 1 USD = {settings.usdToLbpRate.toLocaleString()} LBP</span>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">{t("finance.date")}</Label>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs">{type === "transfer" ? "From account" : t("common.account")}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {type === "transfer" ? (
              <div>
                <Label className="text-xs">{t("finance.toAccount")}</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.id !== accountId).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">{t("finance.category")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                  <SelectContent>
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
            <Label className="text-xs">{t("finance.note")}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t("finance.linkedTask")}</Label>
              <Select value={relatedTaskId} onValueChange={setRelatedTaskId}>
                <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {tasks.slice(0, 100).map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("finance.linkedGoal")}</Label>
              <Select value={relatedGoalId} onValueChange={setRelatedGoalId}>
                <SelectTrigger><SelectValue placeholder={t("common.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">{t("finance.recurrence")}</Label>
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
              <Trash2 className="h-4 w-4 me-1" /> {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={submit}>{existing ? t("common.save") : t("finance.add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
