export type AccountType = "cash" | "bank" | "savings" | "credit";
export type TxType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense";
export type BudgetPeriod = "monthly" | "weekly";
export type FinanceRecurrenceFreq = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // derived & cached
  initialBalance: number; // opening balance baseline
  currency: string;
  color?: string;
  archived?: boolean;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  parentCategoryId?: string;
  color: string;
  icon?: string; // lucide icon name
  createdAt: number;
}

export interface FinanceRecurrence {
  freq: FinanceRecurrenceFreq;
  intervalDays?: number;
  dayOfMonth?: number; // for monthly
  weekday?: number; // for weekly
  until?: number;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number; // always positive; sign derived from type
  categoryId?: string;
  accountId: string;
  toAccountId?: string; // for transfers
  date: number;
  note?: string;
  relatedTaskId?: string;
  relatedGoalId?: string;
  recurrence?: FinanceRecurrence;
  recurrenceParentId?: string;
  createdAt: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  limitAmount: number;
  period: BudgetPeriod;
  startDate: number;
  createdAt: number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number; // tracked manually or via deposits
  currency: string; // e.g. "USD" or "LBP"
  deadline?: number;
  linkedGoalId?: string;
  accountId?: string; // optional dedicated account
  color?: string;
  createdAt: number;
}
