import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/core/store";
import i18n from "@/core/i18n";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { eachDayOfInterval, subDays, isSameDay, startOfMonth, endOfMonth, isSameMonth, subMonths } from "date-fns";
import { formatWhen } from "@/core/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { fmtMoney, savingsRate, topCategories, convertCurrency } from "@/core/finance-utils";
import { ChartCard } from "@/components/common/ChartCard";

export const Route = createFileRoute("/finance/analytics")({
  head: () => ({ meta: [{ title: i18n.t("meta.financeAnalytics") }] }),
  component: FinanceAnalytics,
});

function FinanceAnalytics() {
  const { t } = useTranslation();
  const { transactions, categories, accounts, sessions, projects, settings } = useStore();
  const currency = settings.baseCurrency;
  const rate = settings.usdToLbpRate;
  const txCurrency = (accountId: string) => accounts.find((a) => a.id === accountId)?.currency ?? "USD";
  const toBase = (amt: number, from: string) => convertCurrency(amt, from, currency, rate);

  const last30 = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }), []);

  const dailySpend = last30.map((d) => ({
    date: formatWhen(d, "MMM d"),
    expense: Math.round(transactions.filter((tx) => tx.type === "expense" && isSameDay(tx.date, d))
      .reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0)),
    income: Math.round(transactions.filter((tx) => tx.type === "income" && isSameDay(tx.date, d))
      .reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0)),
  }));

  // Last 6 months income vs expenses
  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
  const monthly = months.map((m) => {
    const start = startOfMonth(m).getTime(), end = endOfMonth(m).getTime();
    const inP = transactions.filter((tx) => tx.date >= start && tx.date <= end);
    const income = inP.filter((tx) => tx.type === "income").reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0);
    const expenses = inP.filter((tx) => tx.type === "expense").reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0);
    return { month: formatWhen(m, "MMM"), income: Math.round(income), expenses: Math.round(expenses), net: Math.round(income - expenses) };
  });

  const thisMonthTx = transactions.filter((tx) => isSameMonth(tx.date, new Date()));
  const expenses = thisMonthTx.filter((tx) => tx.type === "expense").reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0);
  const income = thisMonthTx.filter((tx) => tx.type === "income").reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0);
  const sRate = savingsRate(income, expenses);

  const byCategory = topCategories(thisMonthTx, categories, "expense", 8);

  const dailyAvg = expenses / Math.max(1, new Date().getDate());

  // Net worth (sum balances converted to base currency)
  const netWorth = accounts.reduce((a, x) => a + toBase(x.balance, x.currency), 0);

  // Time vs money: sessions hours vs money spent on related project tasks
  const projectInsights = projects.slice(0, 5).map((p) => {
    const taskIds = useStore.getState().tasks.filter((task) => task.projectId === p.id).map((task) => task.id);
    const hours = sessions.filter((s) => s.taskId && taskIds.includes(s.taskId) && s.type === "focus")
      .reduce((a, s) => a + s.duration, 0) / 3600;
    const money = transactions.filter((tx) => tx.type === "expense" && tx.relatedTaskId && taskIds.includes(tx.relatedTaskId))
      .reduce((a, tx) => a + toBase(tx.amount, txCurrency(tx.accountId)), 0);
    return { name: p.name, hours: Math.round(hours * 10) / 10, money: Math.round(money) };
  });

  // No-spend days this month
  const daysThisMonth = eachDayOfInterval({ start: startOfMonth(new Date()), end: new Date() });
  const noSpendDays = daysThisMonth.filter((d) =>
    !transactions.some((tx) => tx.type === "expense" && isSameDay(tx.date, d))
  ).length;

  return (
    <PageContainer>
      <PageHeader title="Finance analytics" description={`Totals in ${currency} @ 1 USD = ${rate.toLocaleString()} LBP. Spending patterns, trends, and money-time insight.`} />

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
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--chart-text)", fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
              <Bar dataKey="expense" fill="var(--chart-destructive)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Income vs expenses — last 6 months">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="income" fill="var(--chart-success)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--chart-destructive)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Net cash flow trend">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthly}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <YAxis tick={{ fill: "var(--chart-text)", fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtMoney(Number(v), currency)} />
              <Line type="monotone" dataKey="net" stroke="var(--chart-primary)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by category — this month">
          {byCategory.length === 0
            ? <div className="h-[220px] grid place-items-center text-xs text-muted-foreground">{t("finance.noExpenses")}</div>
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
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("finance.timeMoney")}</div>
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
  background: "var(--popover)",
  border: "1px solid var(--border)",
  color: "var(--popover-foreground)",
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
