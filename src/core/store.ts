import { create } from "zustand";
import { addDays, addMonths, addWeeks, addYears, format, startOfDay, isAfter } from "date-fns";
import {
  getAll, putOne, delOne, uid, getOne,
} from "./db";
import type {
  Task, TimeBlock, Project, Goal, Session, Tag, LogEntry, Settings, TaskStatus, Recurrence,
} from "./types";
import type {
  Account, Transaction, Category, Budget, SavingsGoal, FinanceRecurrence,
} from "./finance-types";
import { recomputeAccountBalances } from "./finance-utils";

interface State {
  loaded: boolean;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  projects: Project[];
  goals: Goal[];
  sessions: Session[];
  tags: Tag[];
  logs: LogEntry[];
  settings: Settings;

  // Finance
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];

  load: () => Promise<void>;

  // tasks
  upsertTask: (t: Partial<Task> & { title?: string }) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;

  // time blocks
  upsertBlock: (b: Partial<TimeBlock> & { startTime?: number; endTime?: number; title?: string }) => Promise<TimeBlock>;
  deleteBlock: (id: string) => Promise<void>;

  // projects
  upsertProject: (p: Partial<Project> & { name?: string }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;

  // goals
  upsertGoal: (g: Partial<Goal> & { title?: string }) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;

  // sessions
  addSession: (s: Omit<Session, "id">) => Promise<Session>;

  // tags
  upsertTag: (t: Partial<Tag> & { name?: string }) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;

  // logs
  upsertLog: (l: Partial<LogEntry> & { content?: string; date?: string }) => Promise<LogEntry>;
  deleteLog: (id: string) => Promise<void>;

  // settings
  updateSettings: (s: Partial<Settings>) => Promise<void>;

  // recurrence: ensure recurring task instances exist for the next N days
  materializeRecurring: () => Promise<void>;

  // ============ FINANCE ============
  upsertAccount: (a: Partial<Account> & { name?: string }) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;

  upsertTransaction: (t: Partial<Transaction> & { type?: Transaction["type"]; amount?: number; accountId?: string }) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;

  upsertCategory: (c: Partial<Category> & { name?: string; type?: Category["type"] }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  upsertBudget: (b: Partial<Budget> & { categoryId?: string; limitAmount?: number }) => Promise<Budget>;
  deleteBudget: (id: string) => Promise<void>;

  upsertSavingsGoal: (g: Partial<SavingsGoal> & { title?: string; targetAmount?: number }) => Promise<SavingsGoal>;
  deleteSavingsGoal: (id: string) => Promise<void>;

  recomputeBalances: () => void;
  materializeFinanceRecurring: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  id: "global",
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroLongEvery: 4,
  notificationsEnabled: false,
  workdayStart: 8,
  workdayEnd: 20,
  baseCurrency: "USD",
  usdToLbpRate: 90000,
};

export const useStore = create<State>((set, get) => ({
  loaded: false,
  tasks: [],
  timeBlocks: [],
  projects: [],
  goals: [],
  sessions: [],
  tags: [],
  logs: [],
  settings: DEFAULT_SETTINGS,

  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  savingsGoals: [],

  load: async () => {
    const [tasks, timeBlocks, projects, goals, sessions, tags, logs,
      accounts, transactions, categories, budgets, savingsGoals] = await Promise.all([
      getAll<Task>("tasks"),
      getAll<TimeBlock>("timeBlocks"),
      getAll<Project>("projects"),
      getAll<Goal>("goals"),
      getAll<Session>("sessions"),
      getAll<Tag>("tags"),
      getAll<LogEntry>("logs"),
      getAll<Account>("accounts"),
      getAll<Transaction>("transactions"),
      getAll<Category>("categories"),
      getAll<Budget>("budgets"),
      getAll<SavingsGoal>("savingsGoals"),
    ]);
    let settings = await getOne<Settings>("settings", "global");
    if (!settings) {
      settings = DEFAULT_SETTINGS;
      await putOne("settings", settings);
    } else {
      // backfill new fields for existing installs
      settings = { ...DEFAULT_SETTINGS, ...settings };
      await putOne("settings", settings);
    }

    // Seed sample data on first run
    if (tasks.length === 0 && projects.length === 0 && tags.length === 0) {
      await seed();
    }
    if (categories.length === 0 && accounts.length === 0) {
      await seedFinance();
    }

    const [t2, b2, p2, g2, ses2, tg2, lg2,
      acc2, tx2, cat2, bud2, sg2] = await Promise.all([
      getAll<Task>("tasks"),
      getAll<TimeBlock>("timeBlocks"),
      getAll<Project>("projects"),
      getAll<Goal>("goals"),
      getAll<Session>("sessions"),
      getAll<Tag>("tags"),
      getAll<LogEntry>("logs"),
      getAll<Account>("accounts"),
      getAll<Transaction>("transactions"),
      getAll<Category>("categories"),
      getAll<Budget>("budgets"),
      getAll<SavingsGoal>("savingsGoals"),
    ]);

    const accWithBalances = recomputeAccountBalances(acc2, tx2);

    set({
      tasks: t2, timeBlocks: b2, projects: p2, goals: g2, sessions: ses2, tags: tg2, logs: lg2, settings,
      accounts: accWithBalances, transactions: tx2, categories: cat2, budgets: bud2, savingsGoals: sg2,
      loaded: true,
    });

    await get().materializeRecurring();
    await get().materializeFinanceRecurring();
  },

  upsertTask: async (patch) => {
    const now = Date.now();
    const existing = patch.id ? get().tasks.find((x) => x.id === patch.id) : undefined;
    const task: Task = {
      id: existing?.id ?? uid(),
      title: patch.title ?? existing?.title ?? "Untitled",
      description: patch.description ?? existing?.description,
      status: patch.status ?? existing?.status ?? "todo",
      priority: patch.priority ?? existing?.priority ?? "med",
      effort: patch.effort ?? existing?.effort,
      deadline: "deadline" in patch ? patch.deadline : existing?.deadline,
      projectId: patch.projectId ?? existing?.projectId,
      goalId: patch.goalId ?? existing?.goalId,
      tagIds: patch.tagIds ?? existing?.tagIds ?? [],
      parentTaskId: patch.parentTaskId ?? existing?.parentTaskId,
      dependsOnIds: patch.dependsOnIds ?? existing?.dependsOnIds ?? [],
      recurrence: patch.recurrence ?? existing?.recurrence,
      recurrenceParentId: patch.recurrenceParentId ?? existing?.recurrenceParentId,
      completedAt:
        patch.status === "done"
          ? existing?.completedAt ?? now
          : patch.status
          ? undefined
          : existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await putOne("tasks", task);
    set((s) => ({
      tasks: existing ? s.tasks.map((x) => (x.id === task.id ? task : x)) : [...s.tasks, task],
    }));
    return task;
  },

  deleteTask: async (id) => {
    await delOne("tasks", id);
    const subs = get().tasks.filter((t) => t.parentTaskId === id);
    for (const s of subs) await delOne("tasks", s.id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id && t.parentTaskId !== id) }));
  },

  setTaskStatus: async (id, status) => {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    await get().upsertTask({ ...t, status });
  },

  upsertBlock: async (patch) => {
    const existing = patch.id ? get().timeBlocks.find((x) => x.id === patch.id) : undefined;
    const block: TimeBlock = {
      id: existing?.id ?? uid(),
      taskId: patch.taskId ?? existing?.taskId,
      title: patch.title ?? existing?.title ?? "Time Block",
      startTime: patch.startTime ?? existing?.startTime ?? Date.now(),
      endTime: patch.endTime ?? existing?.endTime ?? Date.now() + 3600_000,
      type: patch.type ?? existing?.type ?? "deep",
      isCompleted: patch.isCompleted ?? existing?.isCompleted ?? false,
      notes: patch.notes ?? existing?.notes,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("timeBlocks", block);
    set((s) => ({
      timeBlocks: existing ? s.timeBlocks.map((x) => (x.id === block.id ? block : x)) : [...s.timeBlocks, block],
    }));
    return block;
  },
  deleteBlock: async (id) => {
    await delOne("timeBlocks", id);
    set((s) => ({ timeBlocks: s.timeBlocks.filter((x) => x.id !== id) }));
  },

  upsertProject: async (patch) => {
    const existing = patch.id ? get().projects.find((x) => x.id === patch.id) : undefined;
    const p: Project = {
      id: existing?.id ?? uid(),
      name: patch.name ?? existing?.name ?? "Untitled Project",
      description: patch.description ?? existing?.description,
      color: patch.color ?? existing?.color ?? "#d4a574",
      archived: patch.archived ?? existing?.archived ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("projects", p);
    set((s) => ({ projects: existing ? s.projects.map((x) => (x.id === p.id ? p : x)) : [...s.projects, p] }));
    return p;
  },
  deleteProject: async (id) => {
    await delOne("projects", id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  upsertGoal: async (patch) => {
    const existing = patch.id ? get().goals.find((x) => x.id === patch.id) : undefined;
    const start = patch.startDate ?? existing?.startDate ?? Date.now();
    const dur = patch.durationDays ?? existing?.durationDays ?? 30;
    const g: Goal = {
      id: existing?.id ?? uid(),
      title: patch.title ?? existing?.title ?? "Untitled Goal",
      description: patch.description ?? existing?.description,
      durationDays: dur,
      startDate: start,
      endDate: patch.endDate ?? existing?.endDate ?? addDays(start, dur).getTime(),
      linkedTaskIds: patch.linkedTaskIds ?? existing?.linkedTaskIds ?? [],
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("goals", g);
    set((s) => ({ goals: existing ? s.goals.map((x) => (x.id === g.id ? g : x)) : [...s.goals, g] }));
    return g;
  },
  deleteGoal: async (id) => {
    await delOne("goals", id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },

  addSession: async (s) => {
    const ses: Session = { id: uid(), ...s };
    await putOne("sessions", ses);
    set((st) => ({ sessions: [...st.sessions, ses] }));
    return ses;
  },

  upsertTag: async (patch) => {
    const existing = patch.id ? get().tags.find((x) => x.id === patch.id) : undefined;
    const t: Tag = {
      id: existing?.id ?? uid(),
      name: patch.name ?? existing?.name ?? "tag",
      color: patch.color ?? existing?.color ?? "#d4a574",
    };
    await putOne("tags", t);
    set((s) => ({ tags: existing ? s.tags.map((x) => (x.id === t.id ? t : x)) : [...s.tags, t] }));
    return t;
  },
  deleteTag: async (id) => {
    await delOne("tags", id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  },

  upsertLog: async (patch) => {
    const existing = patch.id ? get().logs.find((x) => x.id === patch.id) : undefined;
    const l: LogEntry = {
      id: existing?.id ?? uid(),
      date: patch.date ?? existing?.date ?? format(new Date(), "yyyy-MM-dd"),
      content: patch.content ?? existing?.content ?? "",
      relatedTaskId: patch.relatedTaskId ?? existing?.relatedTaskId,
      mood: patch.mood ?? existing?.mood,
      energy: patch.energy ?? existing?.energy,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("logs", l);
    set((s) => ({ logs: existing ? s.logs.map((x) => (x.id === l.id ? l : x)) : [...s.logs, l] }));
    return l;
  },
  deleteLog: async (id) => {
    await delOne("logs", id);
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch, id: "global" as const };
    await putOne("settings", next);
    set({ settings: next });
  },

  materializeRecurring: async () => {
    const tasks = get().tasks;
    const templates = tasks.filter((t) => t.recurrence && t.recurrence.freq !== "none" && !t.recurrenceParentId);
    if (templates.length === 0) return;
    const horizonDays = 14;
    const today = startOfDay(new Date());
    for (const tpl of templates) {
      const r = tpl.recurrence as Recurrence;
      for (let i = 0; i < horizonDays; i++) {
        const day = addDays(today, i);
        let shouldCreate = false;
        if (r.freq === "daily") shouldCreate = true;
        else if (r.freq === "weekly" && r.weekdays?.includes(day.getDay())) shouldCreate = true;
        else if (r.freq === "custom" && r.intervalDays) {
          const diff = Math.floor((day.getTime() - startOfDay(tpl.createdAt).getTime()) / 86400000);
          shouldCreate = diff >= 0 && diff % r.intervalDays === 0;
        }
        if (!shouldCreate) continue;
        const dayStr = format(day, "yyyy-MM-dd");
        const exists = tasks.some(
          (t) => t.recurrenceParentId === tpl.id && t.deadline && format(t.deadline, "yyyy-MM-dd") === dayStr
        );
        if (exists) continue;
        await get().upsertTask({
          title: tpl.title,
          description: tpl.description,
          status: "todo",
          priority: tpl.priority,
          effort: tpl.effort,
          deadline: day.getTime(),
          projectId: tpl.projectId,
          goalId: tpl.goalId,
          tagIds: tpl.tagIds,
          recurrenceParentId: tpl.id,
        });
      }
    }
  },

  // ============ FINANCE ============
  upsertAccount: async (patch) => {
    const existing = patch.id ? get().accounts.find((x) => x.id === patch.id) : undefined;
    const a: Account = {
      id: existing?.id ?? uid(),
      name: patch.name ?? existing?.name ?? "Account",
      type: patch.type ?? existing?.type ?? "cash",
      initialBalance: patch.initialBalance ?? existing?.initialBalance ?? 0,
      balance: 0,
      currency: patch.currency ?? existing?.currency ?? "USD",
      color: patch.color ?? existing?.color ?? "#d4a574",
      archived: patch.archived ?? existing?.archived ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("accounts", a);
    set((s) => {
      const accounts = existing ? s.accounts.map((x) => (x.id === a.id ? a : x)) : [...s.accounts, a];
      return { accounts: recomputeAccountBalances(accounts, s.transactions) };
    });
    return a;
  },
  deleteAccount: async (id) => {
    await delOne("accounts", id);
    set((s) => ({ accounts: s.accounts.filter((x) => x.id !== id) }));
  },

  upsertTransaction: async (patch) => {
    const existing = patch.id ? get().transactions.find((x) => x.id === patch.id) : undefined;
    const t: Transaction = {
      id: existing?.id ?? uid(),
      type: patch.type ?? existing?.type ?? "expense",
      amount: Math.abs(patch.amount ?? existing?.amount ?? 0),
      categoryId: patch.categoryId ?? existing?.categoryId,
      accountId: patch.accountId ?? existing?.accountId ?? "",
      toAccountId: patch.toAccountId ?? existing?.toAccountId,
      date: patch.date ?? existing?.date ?? Date.now(),
      note: patch.note ?? existing?.note,
      relatedTaskId: patch.relatedTaskId ?? existing?.relatedTaskId,
      relatedGoalId: patch.relatedGoalId ?? existing?.relatedGoalId,
      recurrence: patch.recurrence ?? existing?.recurrence,
      recurrenceParentId: patch.recurrenceParentId ?? existing?.recurrenceParentId,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("transactions", t);
    set((s) => {
      const transactions = existing ? s.transactions.map((x) => (x.id === t.id ? t : x)) : [...s.transactions, t];
      return { transactions, accounts: recomputeAccountBalances(s.accounts, transactions) };
    });
    return t;
  },
  deleteTransaction: async (id) => {
    await delOne("transactions", id);
    set((s) => {
      const transactions = s.transactions.filter((x) => x.id !== id);
      return { transactions, accounts: recomputeAccountBalances(s.accounts, transactions) };
    });
  },

  upsertCategory: async (patch) => {
    const existing = patch.id ? get().categories.find((x) => x.id === patch.id) : undefined;
    const c: Category = {
      id: existing?.id ?? uid(),
      name: patch.name ?? existing?.name ?? "Category",
      type: patch.type ?? existing?.type ?? "expense",
      parentCategoryId: patch.parentCategoryId ?? existing?.parentCategoryId,
      color: patch.color ?? existing?.color ?? "#d4a574",
      icon: patch.icon ?? existing?.icon,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("categories", c);
    set((s) => ({ categories: existing ? s.categories.map((x) => (x.id === c.id ? c : x)) : [...s.categories, c] }));
    return c;
  },
  deleteCategory: async (id) => {
    await delOne("categories", id);
    // Cascade: also delete child categories
    const children = get().categories.filter((c) => c.parentCategoryId === id);
    for (const child of children) await delOne("categories", child.id);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id && c.parentCategoryId !== id) }));
  },

  upsertBudget: async (patch) => {
    const existing = patch.id ? get().budgets.find((x) => x.id === patch.id) : undefined;
    const b: Budget = {
      id: existing?.id ?? uid(),
      categoryId: patch.categoryId ?? existing?.categoryId ?? "",
      limitAmount: patch.limitAmount ?? existing?.limitAmount ?? 0,
      period: patch.period ?? existing?.period ?? "monthly",
      startDate: patch.startDate ?? existing?.startDate ?? Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("budgets", b);
    set((s) => ({ budgets: existing ? s.budgets.map((x) => (x.id === b.id ? b : x)) : [...s.budgets, b] }));
    return b;
  },
  deleteBudget: async (id) => {
    await delOne("budgets", id);
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
  },

  upsertSavingsGoal: async (patch) => {
    const existing = patch.id ? get().savingsGoals.find((x) => x.id === patch.id) : undefined;
    const g: SavingsGoal = {
      id: existing?.id ?? uid(),
      title: patch.title ?? existing?.title ?? "Savings Goal",
      targetAmount: patch.targetAmount ?? existing?.targetAmount ?? 0,
      currentAmount: patch.currentAmount ?? existing?.currentAmount ?? 0,
      deadline: patch.deadline ?? existing?.deadline,
      linkedGoalId: patch.linkedGoalId ?? existing?.linkedGoalId,
      accountId: patch.accountId ?? existing?.accountId,
      color: patch.color ?? existing?.color ?? "#90b890",
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("savingsGoals", g);
    set((s) => ({ savingsGoals: existing ? s.savingsGoals.map((x) => (x.id === g.id ? g : x)) : [...s.savingsGoals, g] }));
    return g;
  },
  deleteSavingsGoal: async (id) => {
    await delOne("savingsGoals", id);
    set((s) => ({ savingsGoals: s.savingsGoals.filter((g) => g.id !== id) }));
  },

  recomputeBalances: () => {
    set((s) => ({ accounts: recomputeAccountBalances(s.accounts, s.transactions) }));
  },

  materializeFinanceRecurring: async () => {
    const txs = get().transactions;
    const templates = txs.filter((t) => t.recurrence && t.recurrence.freq !== "none" && !t.recurrenceParentId);
    if (templates.length === 0) return;
    const now = Date.now();
    for (const tpl of templates) {
      const r = tpl.recurrence as FinanceRecurrence;
      let next = nextOccurrence(tpl.date, r);
      // generate occurrences up to today
      let safety = 240;
      while (next <= now && safety-- > 0) {
        if (r.until && next > r.until) break;
        const exists = txs.some((t) => t.recurrenceParentId === tpl.id && Math.abs(t.date - next) < 60_000);
        if (!exists) {
          await get().upsertTransaction({
            type: tpl.type,
            amount: tpl.amount,
            categoryId: tpl.categoryId,
            accountId: tpl.accountId,
            toAccountId: tpl.toAccountId,
            date: next,
            note: tpl.note,
            relatedTaskId: tpl.relatedTaskId,
            relatedGoalId: tpl.relatedGoalId,
            recurrenceParentId: tpl.id,
          });
        }
        next = nextOccurrence(next, r);
      }
    }
  },
}));

function nextOccurrence(from: number, r: FinanceRecurrence): number {
  const d = new Date(from);
  switch (r.freq) {
    case "daily": return addDays(d, r.intervalDays ?? 1).getTime();
    case "weekly": return addWeeks(d, 1).getTime();
    case "monthly": return addMonths(d, 1).getTime();
    case "yearly": return addYears(d, 1).getTime();
    default: return isAfter(d, new Date()) ? d.getTime() : Date.now() + 86400000;
  }
}

async function seed() {
  const projId = uid();
  const proj2 = uid();
  const goalId = uid();
  const tag1 = uid(), tag2 = uid(), tag3 = uid();

  await putOne("projects", { id: projId, name: "Life OS Launch", description: "Ship v1 of personal OS", color: "#d4a574", createdAt: Date.now() });
  await putOne("projects", { id: proj2, name: "Health & Fitness", description: "Habits, training, sleep", color: "#90b890", createdAt: Date.now() });

  await putOne("goals", {
    id: goalId, title: "Ship Life OS in 30 days", durationDays: 30,
    startDate: Date.now(), endDate: Date.now() + 30 * 86400000, linkedTaskIds: [], createdAt: Date.now(),
  });

  await putOne("tags", { id: tag1, name: "deep-work", color: "#d4a574" });
  await putOne("tags", { id: tag2, name: "admin", color: "#90b8c8" });
  await putOne("tags", { id: tag3, name: "health", color: "#a8c888" });

  const now = Date.now();
  const today = startOfDay(new Date()).getTime();
  const samples: Task[] = [
    { id: uid(), title: "Design dashboard layout", status: "in_progress", priority: "high", effort: 90, deadline: today + 18 * 3600000, projectId: projId, goalId, tagIds: [tag1], dependsOnIds: [], createdAt: now, updatedAt: now },
    { id: uid(), title: "Wire IndexedDB models", status: "done", priority: "urgent", effort: 60, projectId: projId, goalId, tagIds: [tag1], dependsOnIds: [], completedAt: now, createdAt: now - 86400000, updatedAt: now },
    { id: uid(), title: "Build Kanban board", status: "todo", priority: "high", effort: 120, deadline: today + 86400000, projectId: projId, goalId, tagIds: [tag1], dependsOnIds: [], createdAt: now, updatedAt: now },
    { id: uid(), title: "Morning run 5km", status: "todo", priority: "med", effort: 30, projectId: proj2, tagIds: [tag3], dependsOnIds: [], createdAt: now, updatedAt: now,
      recurrence: { freq: "weekly", weekdays: [1, 3, 5] } },
    { id: uid(), title: "Inbox zero", status: "backlog", priority: "low", effort: 20, tagIds: [tag2], dependsOnIds: [], createdAt: now, updatedAt: now },
    { id: uid(), title: "Plan week ahead", status: "blocked", priority: "med", tagIds: [tag2], dependsOnIds: [], createdAt: now, updatedAt: now },
  ];
  for (const t of samples) await putOne("tasks", t);

  const t1 = today + 9 * 3600000;
  await putOne("timeBlocks", { id: uid(), title: "Deep work: Dashboard", startTime: t1, endTime: t1 + 5400000, type: "deep", isCompleted: false, taskId: samples[0].id, createdAt: now });
  await putOne("timeBlocks", { id: uid(), title: "Email & admin", startTime: t1 + 6 * 3600000, endTime: t1 + 7 * 3600000, type: "shallow", isCompleted: false, createdAt: now });
}

async function seedFinance() {
  const now = Date.now();

  // Default accounts
  const cash = uid(), bank = uid(), savings = uid();
  await putOne("accounts", { id: cash, name: "Cash", type: "cash", balance: 0, initialBalance: 200, currency: "USD", color: "#d4a574", createdAt: now });
  await putOne("accounts", { id: bank, name: "Bank", type: "bank", balance: 0, initialBalance: 3500, currency: "USD", color: "#90b8c8", createdAt: now });
  await putOne("accounts", { id: savings, name: "Savings", type: "savings", balance: 0, initialBalance: 5000, currency: "USD", color: "#90b890", createdAt: now });

  // Default categories — expense parents + children
  const mkCat = async (name: string, type: "income" | "expense", color: string, icon?: string, parentCategoryId?: string) => {
    const id = uid();
    await putOne("categories", { id, name, type, color, icon, parentCategoryId, createdAt: now });
    return id;
  };

  // EXPENSE
  const food = await mkCat("Food", "expense", "#e8a87c", "Utensils");
  await mkCat("Groceries", "expense", "#e8a87c", "ShoppingBasket", food);
  await mkCat("Restaurants", "expense", "#e8a87c", "UtensilsCrossed", food);
  await mkCat("Coffee", "expense", "#c39b7a", "Coffee", food);

  const transport = await mkCat("Transport", "expense", "#90b8c8", "Car");
  await mkCat("Fuel", "expense", "#90b8c8", "Fuel", transport);
  await mkCat("Taxi", "expense", "#90b8c8", "Car", transport);
  await mkCat("Public transport", "expense", "#90b8c8", "Bus", transport);

  const bills = await mkCat("Bills", "expense", "#c8a890", "Receipt");
  await mkCat("Electricity", "expense", "#c8a890", "Zap", bills);
  await mkCat("Internet", "expense", "#c8a890", "Wifi", bills);
  await mkCat("Phone", "expense", "#c8a890", "Phone", bills);

  const lifestyle = await mkCat("Lifestyle", "expense", "#b890c8", "Sparkles");
  await mkCat("Gym", "expense", "#b890c8", "Dumbbell", lifestyle);
  await mkCat("Entertainment", "expense", "#b890c8", "Film", lifestyle);
  await mkCat("Subscriptions", "expense", "#b890c8", "Repeat", lifestyle);

  const shopping = await mkCat("Shopping", "expense", "#d4a574", "ShoppingBag");
  await mkCat("Clothes", "expense", "#d4a574", "Shirt", shopping);
  await mkCat("Electronics", "expense", "#d4a574", "Laptop", shopping);

  await mkCat("Health", "expense", "#e87c8a", "Heart");
  await mkCat("Education", "expense", "#a8c888", "GraduationCap");

  // INCOME
  const salaryId = await mkCat("Salary", "income", "#90c890", "Briefcase");
  await mkCat("Freelance", "income", "#90c890", "Code");
  await mkCat("Business", "income", "#90c890", "Store");
  await mkCat("Investments", "income", "#90c890", "TrendingUp");
  await mkCat("Gifts", "income", "#90c890", "Gift");

  // Sample transactions over the last ~25 days
  const sample = [
    { d: 1, t: "expense", amt: 4.5, cat: "Coffee", acc: cash, note: "Latte" },
    { d: 1, t: "expense", amt: 32.1, cat: "Groceries", acc: bank, note: "Weekly shop" },
    { d: 2, t: "expense", amt: 12, cat: "Public transport", acc: cash, note: "Metro card" },
    { d: 3, t: "expense", amt: 9.99, cat: "Subscriptions", acc: bank, note: "Streaming" },
    { d: 4, t: "expense", amt: 45, cat: "Restaurants", acc: bank, note: "Dinner" },
    { d: 5, t: "income", amt: 3200, cat: "Salary", acc: bank, note: "Monthly salary" },
    { d: 6, t: "expense", amt: 60, cat: "Electricity", acc: bank },
    { d: 7, t: "expense", amt: 35, cat: "Internet", acc: bank },
    { d: 8, t: "expense", amt: 89, cat: "Clothes", acc: bank },
    { d: 10, t: "expense", amt: 25, cat: "Gym", acc: bank },
    { d: 12, t: "income", amt: 450, cat: "Freelance", acc: bank, note: "Logo design" },
    { d: 14, t: "expense", amt: 22, cat: "Fuel", acc: cash },
    { d: 16, t: "expense", amt: 15.5, cat: "Restaurants", acc: cash },
    { d: 18, t: "expense", amt: 6, cat: "Coffee", acc: cash },
    { d: 20, t: "expense", amt: 110, cat: "Electronics", acc: bank, note: "USB-C hub" },
  ];

  // Need category lookup
  const allCats = await getAll<Category>("categories");
  const catByName = (n: string) => allCats.find((c) => c.name === n)?.id;

  for (const s of sample) {
    const date = now - s.d * 86400000;
    await putOne("transactions", {
      id: uid(),
      type: s.t as any,
      amount: s.amt,
      categoryId: catByName(s.cat),
      accountId: s.acc,
      date,
      note: (s as any).note,
      createdAt: date,
    });
  }

  // Recurring salary template
  await putOne("transactions", {
    id: uid(),
    type: "income",
    amount: 3200,
    categoryId: salaryId,
    accountId: bank,
    date: now,
    note: "Monthly salary (recurring)",
    recurrence: { freq: "monthly", dayOfMonth: new Date().getDate() },
    createdAt: now,
  });

  // A budget on Food
  await putOne("budgets", {
    id: uid(), categoryId: food, limitAmount: 400, period: "monthly", startDate: now, createdAt: now,
  });
  await putOne("budgets", {
    id: uid(), categoryId: lifestyle, limitAmount: 150, period: "monthly", startDate: now, createdAt: now,
  });

  // Savings goal
  await putOne("savingsGoals", {
    id: uid(), title: "Emergency fund", targetAmount: 5000, currentAmount: 1850,
    deadline: now + 180 * 86400000, accountId: savings, color: "#90b890", createdAt: now,
  });
  await putOne("savingsGoals", {
    id: uid(), title: "New laptop", targetAmount: 2000, currentAmount: 600,
    deadline: now + 90 * 86400000, color: "#d4a574", createdAt: now,
  });
}
