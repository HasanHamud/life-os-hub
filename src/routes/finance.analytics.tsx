import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/core/store";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { eachDayOfInterval, subDays, format, isSameDay, startOfMonth, endOfMonth, isSameMonth, subMonths } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { fmtMoney, savingsRate, topCategories } from "@/core/finance-utils";

export const Route = createFileRoute("/finance/analytics")({
  head: () => ({ meta: [{ title: "Finance Analytics — Life OS" }] }),
  component: FinanceAnalytics,
});

function FinanceAnalytics() {
  const { transactions, categories, accounts, sessions, projects } = useStore();
  const currency = accounts[0]?.currency ?? "USD";

  const last30 = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }), []);

  const dailySpend = last30.map((d) => ({
    date: format(d, "MMM d"),
    expense: Math.round(transactions.filter((t) => t.type === "expense" && isSameDay(t.date, d)).reduce((a, t) => a + t.amount, 0)),
    income: Math.round(transactions.filter((t) => t.type === "income" && isSameDay(t.date, d)).reduce((a, t) => a + t.amount, 0)),
  }));

  // Last 6 months income vs expenses
  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
  const monthly = months.map((m) => {
    const start = startOfMonth(m).getTime(), end = endOfMonth(m).getTime();
    const inP = transactions.filter((t) => t.date >= start && t.date <= end);
    const income = inP.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const expenses = inP.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    return { month: format(m, "MMM"), income: Math.round(income), expenses: Math.round(expenses), net: Math.round(income - expenses) };
  });

  const thisMonthTx = transactions.filter((t) => isSameMonth(t.date, new Date()));
  const expenses = thisMonthTx.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const income = thisMonthTx.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const sRate = savingsRate(income, expenses);

  const byCategory = topCategories(thisMonthTx, categories, "expense", 8);

  const dailyAvg = expenses / Math.max(1, new Date().getDate());

  // Net worth (simple: sum balances)
  const netWorth = accounts.reduce((a, x) => a + x.balance, 0);

  // Time vs money: sessions hours vs money spent on related project tasks
  const projectInsights = projects.slice(0, 5).map((p) => {
    const taskIds = useStore.getState().tasks.filter((t) => t.projectId === p.id).map((t) => t.id);
    const hours = sessions.filter((s) => s.taskId && taskIds.includes(s.taskId) && s.type === "focus")
      .reduce((a, s) => a + s.duration, 0) / 3600;
    const money = transactions.filter((t) => t.type === "expense" && t.relatedTaskId && taskIds.includes(t.relatedTaskId))
      .reduce((a, t) => a + t.amount, 0);
    return { name: p.name, hours: Math.round(hours * 10) / 10, money: Math.round(money) };
  });

  // No-spend days this month
  const daysThisMonth = eachDayOfInterval({ start: startOfMonth(new Date()), end: new Date() });
  const noSpendDays = daysThisMonth.filter((d) =>
    !transactions.some((t) => t.type === "expense" && isSameDay(t.date, d))
  ).length;

  return (
    <PageContainer>
      <PageHeader title="Finance analytics" description="Spending patterns, trends, and money-time insight." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Net worth" value={fmtMoney(netWorth, currency)} hint="Sum of account balances" />
        <Stat label="Savings rate" value={`${sRate}%`} hint="This month" />
        <Stat label="Daily avg spend" value={fmtMoney(dailyAvg, currency)} hint="Expenses ÷ days" />
        <Stat label="No-spend days" value={`${noSpendDays}`} hint="So far this month" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Daily spending — last 30 days">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailySpend}>
              <CartesianGrid stroke="oklch(0.26 0.014 65)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
              <Bar dataKey="expense" fill="oklch(0.62 0.20 25)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Income vs expenses — last 6 months">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid stroke="oklch(0.26 0.014 65)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <YAxis tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="oklch(0.70 0.13 145)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="oklch(0.62 0.20 25)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Net cash flow trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid stroke="oklch(0.26 0.014 65)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <YAxis tick={{ fill: "oklch(0.64 0.018 75)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
              <Line type="monotone" dataKey="net" stroke="oklch(0.78 0.13 70)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by category — this month">
          {byCategory.length === 0
            ? <div className="h-[220px] grid place-items-center text-xs text-muted-foreground">No expenses yet this month.</div>
            : <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byCategory} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {byCategory.map((d) => <Cell key={d.id} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
                </PieChart>
              </ResponsiveContainer>}
        </ChartCard>
      </div>

      {projectInsights.some((x) => x.hours > 0 || x.money > 0) && (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Time vs money — by project</div>
          <div className="space-y-2">
            {projectInsights.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-border/50">
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground tabular-nums text-xs">
                  {p.hours}h · {fmtMoney(p.money, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

const tooltipStyle = {
  background: "oklch(0.22 0.014 64)",
  border: "1px solid oklch(0.30 0.022 70)",
  borderRadius: 8, fontSize: 12,
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-display font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}
