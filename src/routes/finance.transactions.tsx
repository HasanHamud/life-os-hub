import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney, signedAmount, categoryPath } from "@/core/finance-utils";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { format } from "date-fns";
import { ArrowRightLeft, TrendingDown, TrendingUp, Plus, Download, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/finance/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Finance" }] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { transactions, categories, accounts, tasks } = useStore();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const list = useMemo(() => {
    return [...transactions]
      .sort((a, b) => b.date - a.date)
      .filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (accountFilter !== "all" && t.accountId !== accountFilter && t.toAccountId !== accountFilter) return false;
        if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
        if (q.trim()) {
          const txt = (t.note ?? "") + " " + (categories.find((c) => c.id === t.categoryId)?.name ?? "");
          if (!txt.toLowerCase().includes(q.toLowerCase())) return false;
        }
        return true;
      });
  }, [transactions, q, typeFilter, accountFilter, categoryFilter, categories]);

  const exportCsv = () => {
    const rows = [
      ["date", "type", "amount", "currency", "account", "to_account", "category", "note", "related_task"],
      ...list.map((t) => {
        const acc = accounts.find((a) => a.id === t.accountId);
        const toAcc = accounts.find((a) => a.id === t.toAccountId);
        const cat = categories.find((c) => c.id === t.categoryId);
        const task = tasks.find((tk) => tk.id === t.relatedTaskId);
        return [
          format(t.date, "yyyy-MM-dd HH:mm"),
          t.type,
          String(t.amount),
          acc?.currency ?? "",
          acc?.name ?? "",
          toAcc?.name ?? "",
          cat ? categoryPath(cat, categories) : "",
          (t.note ?? "").replace(/"/g, '""'),
          task?.title ?? "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions-${format(new Date(), "yyyyMMdd")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Transactions"
        description={`${list.length} entries`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </>
        }
      />

      <div className="rounded-xl border bg-card mb-4 p-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search note or category…" className="pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{categoryPath(c, categories)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card divide-y divide-border/50">
        {list.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No transactions match.</div>}
        {list.map((t) => {
          const cat = categories.find((c) => c.id === t.categoryId);
          const acc = accounts.find((a) => a.id === t.accountId);
          const toAcc = accounts.find((a) => a.id === t.toAccountId);
          const sign = signedAmount(t);
          return (
            <button key={t.id} onClick={() => setEditingId(t.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30">
              <div className="h-9 w-9 rounded-md grid place-items-center" style={{ background: `${cat?.color ?? "#888"}25` }}>
                {t.type === "transfer" ? <ArrowRightLeft className="h-4 w-4 text-info" />
                  : t.type === "income" ? <TrendingUp className="h-4 w-4 text-success" />
                  : <TrendingDown className="h-4 w-4 text-destructive" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{t.note || cat?.name || (t.type === "transfer" ? "Transfer" : "—")}</div>
                <div className="text-[11px] text-muted-foreground">
                  {format(t.date, "MMM d, HH:mm")} · {acc?.name ?? "—"}
                  {toAcc && <> → {toAcc.name}</>}
                  {cat && <> · {categoryPath(cat, categories)}</>}
                </div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${sign > 0 ? "text-success" : sign < 0 ? "text-destructive" : "text-info"}`}>
                {sign > 0 ? "+" : sign < 0 ? "−" : ""}{fmtMoney(Math.abs(t.amount), acc?.currency ?? "USD")}
              </div>
            </button>
          );
        })}
      </div>

      <TransactionDialog open={creating} onOpenChange={setCreating} />
      <TransactionDialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)} transactionId={editingId} />
    </PageContainer>
  );
}
