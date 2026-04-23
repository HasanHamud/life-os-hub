import type { Account, Transaction, Category, Budget, SavingsGoal } from "./finance-types";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameWeek } from "date-fns";

export const fmtMoney = (n: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

export const signedAmount = (t: Transaction) =>
  t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0;

export function computeBalance(account: Account, txs: Transaction[]): number {
  let bal = account.initialBalance;
  for (const t of txs) {
    if (t.type === "income" && t.accountId === account.id) bal += t.amount;
    else if (t.type === "expense" && t.accountId === account.id) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.accountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return bal;
}

export function recomputeAccountBalances(accounts: Account[], txs: Transaction[]): Account[] {
  return accounts.map((a) => ({ ...a, balance: computeBalance(a, txs) }));
}

export function categoryPath(c: Category, all: Category[]): string {
  const chain: string[] = [c.name];
  let cur = c;
  const seen = new Set<string>([c.id]);
  while (cur.parentCategoryId) {
    const p = all.find((x) => x.id === cur.parentCategoryId);
    if (!p || seen.has(p.id)) break;
    chain.unshift(p.name);
    seen.add(p.id);
    cur = p;
  }
  return chain.join(" › ");
}

export function txInPeriod(t: Transaction, period: "monthly" | "weekly", ref = new Date()) {
  if (period === "monthly") return isSameMonth(t.date, ref);
  return isSameWeek(t.date, ref, { weekStartsOn: 1 });
}

export function periodRange(period: "monthly" | "weekly", ref = new Date()) {
  if (period === "monthly") return { start: startOfMonth(ref).getTime(), end: endOfMonth(ref).getTime() };
  return {
    start: startOfWeek(ref, { weekStartsOn: 1 }).getTime(),
    end: endOfWeek(ref, { weekStartsOn: 1 }).getTime(),
  };
}

export function budgetSpent(budget: Budget, txs: Transaction[], categories: Category[]): number {
  // Include subcategories
  const allIds = new Set<string>([budget.categoryId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentCategoryId && allIds.has(c.parentCategoryId) && !allIds.has(c.id)) {
        allIds.add(c.id);
        added = true;
      }
    }
  }
  return txs
    .filter((t) => t.type === "expense" && t.categoryId && allIds.has(t.categoryId) && txInPeriod(t, budget.period))
    .reduce((a, t) => a + t.amount, 0);
}

export function savingsRate(income: number, expenses: number) {
  if (income <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((income - expenses) / income) * 100)));
}

export function topCategories(txs: Transaction[], categories: Category[], type: "income" | "expense", limit = 5) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type || !t.categoryId) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([id, total]) => {
      const cat = categories.find((c) => c.id === id);
      return { id, name: cat?.name ?? "—", color: cat?.color ?? "#888", total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function financialHealthScore(opts: {
  savingsRate: number;
  budgetUtilization: number; // 0-1+
  netWorth: number;
}) {
  const sr = Math.max(0, Math.min(100, opts.savingsRate));
  const budgetScore = Math.max(0, 100 - Math.max(0, opts.budgetUtilization - 1) * 100);
  const nwScore = opts.netWorth >= 0 ? 100 : 50;
  return Math.round(sr * 0.5 + budgetScore * 0.3 + nwScore * 0.2);
}
