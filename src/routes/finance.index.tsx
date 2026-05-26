import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { fmtMoney, signedAmount, topCategories, savingsRate, financialHealthScore, budgetSpent, periodRange, convertCurrency } from "@/core/finance-utils";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Plus, ArrowRightLeft, Sparkles } from "lucide-react";
import { format, isWeekend, startOfMonth, endOfMonth } from "date-fns";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/finance/")({
  head: () => ({
    meta: [
      { title: "Finance — Life OS" },
      { name: "description", content: "Track income, expenses, savings, budgets and accounts." },
    ],
  }),
  component: FinanceDashboard,
});

function FinanceDashboard() {
  const { accounts, transactions, categories, budgets, savingsGoals, settings } = useStore();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const currency = settings.baseCurrency;
  const rate = settings.usdToLbpRate;

  // Helper to get the currency of a transaction (derived from its account)
  const txCurrency = (accountId: string) => accounts.find((a) => a.id === accountId)?.currency ?? "USD";
  const toBase = (amt: number, from: string) => convertCurrency(amt, from, currency, rate);

  const totalBalance = accounts.reduce((a, x) => a + toBase(x.balance, x.currency), 0);

  const { start, end } = periodRange("monthly");
  const monthTx = transactions.filter((t) => t.date >= start && t.date <= end);
  const income = monthTx.filter((t) => t.type === "income")
    .reduce((a, t) => a + toBase(t.amount, txCurrency(t.accountId)), 0);
  const expenses = monthTx.filter((t) => t.type === "expense")
    .reduce((a, t) => a + toBase(t.amount, txCurrency(t.accountId)), 0);
  const sRate = savingsRate(income, expenses);

  const recentTx = useMemo(
    () => [...transactions].sort((a, b) => b.date - a.date).slice(0, 8),
    [transactions]
  );

  const topExpense = topCategories(monthTx, categories, "expense", 5);

  // Budget utilization (avg)
  const budgetUtil = budgets.length === 0 ? 0
    : budgets.reduce((a, b) => a + budgetSpent(b, transactions, categories) / Math.max(1, b.limitAmount), 0) / budgets.length;
  const health = financialHealthScore({ savingsRate: sRate, budgetUtilization: budgetUtil, netWorth: totalBalance });

  // Smart insights
  const insights: string[] = [];
  for (const b of budgets) {
    const spent = budgetSpent(b, transactions, categories);
    const cat = categories.find((c) => c.id === b.categoryId);
    if (cat && spent > b.limitAmount) insights.push(`Over budget on ${cat.name} by ${fmtMoney(spent - b.limitAmount, currency)}`);
    else if (cat && spent > b.limitAmount * 0.85) insights.push(`Approaching ${cat.name} budget (${Math.round(spent / b.limitAmount * 100)}%)`);
  }
  if (sRate < 10 && income > 0) insights.push("Savings rate is low this month — consider trimming top categories.");
  const weekendSpend = monthTx.filter((t) => t.type === "expense" && isWeekend(t.date)).reduce((a, t) => a + t.amount, 0);
  if (expenses > 0 && weekendSpend / expenses > 0.5) insights.push("Most spending happens on weekends.");

  return (
    <PageContainer>
      <PageHeader
        title="Finance"
        description={`Overview · ${format(new Date(), "MMMM yyyy")}`}
        actions={
          <>
            <Link to="/finance/transactions"><Button variant="outline" size="sm">All transactions</Button></Link>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </>
        }
      />

      <div className="text-[11px] text-muted-foreground mb-2 tabular-nums">
        Totals shown in <span className="font-medium text-foreground">{currency}</span> · 1 USD = {rate.toLocaleString()} LBP
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat icon={Wallet} label="Total balance" value={fmtMoney(totalBalance, currency)} accent="text-primary" />
        <Stat icon={TrendingUp} label="Income (mo.)" value={fmtMoney(income, currency)} accent="text-success" />
        <Stat icon={TrendingDown} label="Expenses (mo.)" value={fmtMoney(expenses, currency)} accent="text-destructive" />
        <Stat icon={PiggyBank} label="Savings rate" value={`${sRate}%`} accent="text-warning" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card title="Accounts" right={<Link to="/finance/accounts" className="text-xs text-primary hover:underline">Manage →</Link>}>
            {accounts.length === 0
              ? <Empty>No accounts yet.</Empty>
              : <div className="grid sm:grid-cols-2 gap-2">
                  {accounts.map((a) => (
                    <div key={a.id} className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md grid place-items-center text-[10px] font-bold uppercase" style={{ background: `${a.color}30`, color: a.color }}>
                        {a.type[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{a.type}</div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{fmtMoney(a.balance, a.currency)}</div>
                    </div>
                  ))}
                </div>}
          </Card>

          <Card title="Recent transactions" right={<Link to="/finance/transactions" className="text-xs text-primary hover:underline">All →</Link>}>
            {recentTx.length === 0
              ? <Empty>No transactions yet.</Empty>
              : <div className="divide-y divide-border/50">
                  {recentTx.map((t) => {
                    const cat = categories.find((c) => c.id === t.categoryId);
                    const acc = accounts.find((a) => a.id === t.accountId);
                    const sign = signedAmount(t);
                    return (
                      <button key={t.id} onClick={() => setEditingId(t.id)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/30 px-2 rounded-md">
                        <div className="h-8 w-8 rounded-md grid place-items-center" style={{ background: `${cat?.color ?? "#888"}25` }}>
                          {t.type === "transfer" ? <ArrowRightLeft className="h-4 w-4 text-info" />
                            : t.type === "income" ? <TrendingUp className="h-4 w-4 text-success" />
                            : <TrendingDown className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{t.note || cat?.name || (t.type === "transfer" ? "Transfer" : "—")}</div>
                          <div className="text-[11px] text-muted-foreground">{format(t.date, "MMM d")} · {acc?.name ?? "—"}</div>
                        </div>
                        <div className={`text-sm font-semibold tabular-nums ${sign > 0 ? "text-success" : sign < 0 ? "text-destructive" : "text-info"}`}>
                          {sign > 0 ? "+" : sign < 0 ? "−" : ""}{fmtMoney(Math.abs(t.amount), acc?.currency ?? currency)}
                        </div>
                      </button>
                    );
                  })}
                </div>}
          </Card>
        </section>

        <aside className="space-y-6">
          <Card title="Financial health" subtitle="Savings · budgets · net worth">
            <div className="px-3 pb-2 pt-1">
              <div className="flex items-end gap-2">
                <div className="text-4xl font-display font-semibold tabular-nums">{health}</div>
                <div className="text-xs text-muted-foreground pb-2">/ 100</div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-warning to-success" style={{ width: `${health}%` }} />
              </div>
            </div>
          </Card>

          <Card title="Top expense categories">
            {topExpense.length === 0 ? <Empty>No expenses this month.</Empty>
              : <div className="space-y-2 px-2 pb-1">
                  {topExpense.map((c) => {
                    const pct = expenses ? Math.round((c.total / expenses) * 100) : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                          <span className="tabular-nums text-muted-foreground">{fmtMoney(c.total, currency)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </Card>

          <Card title="Savings goals" right={<Link to="/finance/savings" className="text-xs text-primary hover:underline">All →</Link>}>
            {savingsGoals.length === 0 ? <Empty>No goals set.</Empty>
              : <div className="space-y-3 px-2 pb-1">
                  {savingsGoals.slice(0, 3).map((g) => {
                    const pct = g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium truncate">{g.title}</span>
                          <span className="tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full" style={{ width: `${pct}%`, background: g.color }} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                          {fmtMoney(g.currentAmount, g.currency ?? "USD")} / {fmtMoney(g.targetAmount, g.currency ?? "USD")}
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </Card>

          {insights.length > 0 && (
            <Card title="Smart insights">
              <div className="space-y-2 px-2 pb-1">
                {insights.map((i, idx) => (
                  <div key={idx} className="flex gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                    <Sparkles className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span>{i}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card title="USD → LBP rate">
  <RateEditor />
</Card>
        </aside>
      </div>

      <TransactionDialog open={creating} onOpenChange={setCreating} />
      <TransactionDialog open={!!editingId} onOpenChange={(v) => !v && setEditingId(null)} transactionId={editingId} />
    </PageContainer>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        {label}
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-6 text-xs text-muted-foreground">{children}</div>;
}


function RateEditor() {
  const { settings, updateSettings } = useStore();
  const [draft, setDraft] = useState(String(settings.usdToLbpRate));
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const val = Number(draft.replace(/,/g, ""));
    if (!val || val < 1) return;
    await updateSettings({ usdToLbpRate: val });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="px-2 pb-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">1 USD =</span>
        <Input
          type="number"
          step="1000"
          min="1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="h-8 text-sm tabular-nums"
        />
        <span className="text-xs text-muted-foreground shrink-0">LBP</span>
      </div>
      <Button size="sm" className="w-full h-7 text-xs" onClick={save}>
        {saved ? "✓ Saved" : "Update rate"}
      </Button>
    </div>
  );
}