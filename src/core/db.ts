import { openDB, type IDBPDatabase, type DBSchema } from "idb";
import type {
  Task, TimeBlock, Project, Goal, Session, Tag, LogEntry, Snapshot, Settings, Note,
} from "./types";
import type {
  Account, Transaction, Category, Budget, SavingsGoal,
} from "./finance-types";

interface LifeOSDB extends DBSchema {
  tasks: { key: string; value: Task; indexes: { byStatus: string; byProject: string; byGoal: string; byDeadline: number } };
  timeBlocks: { key: string; value: TimeBlock; indexes: { byStart: number; byTask: string } };
  projects: { key: string; value: Project };
  goals: { key: string; value: Goal };
  sessions: { key: string; value: Session; indexes: { byStart: number; byTask: string } };
  tags: { key: string; value: Tag };
  logs: { key: string; value: LogEntry; indexes: { byDate: string } };
  snapshots: { key: string; value: Snapshot };
  settings: { key: string; value: Settings };
  // Finance
  accounts: { key: string; value: Account };
  transactions: { key: string; value: Transaction; indexes: { byDate: number; byAccount: string; byCategory: string } };
  categories: { key: string; value: Category; indexes: { byType: string } };
  budgets: { key: string; value: Budget; indexes: { byCategory: string } };
  savingsGoals: { key: string; value: SavingsGoal };
  notes: { key: string; value: Note; indexes: { byUpdated: number; byStatus: string } };
}

const DB_NAME = "life-os";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<LifeOSDB>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable on server"));
  }
  if (!dbPromise) {
    dbPromise = openDB<LifeOSDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const tasks = db.createObjectStore("tasks", { keyPath: "id" });
          tasks.createIndex("byStatus", "status");
          tasks.createIndex("byProject", "projectId");
          tasks.createIndex("byGoal", "goalId");
          tasks.createIndex("byDeadline", "deadline");

          const tb = db.createObjectStore("timeBlocks", { keyPath: "id" });
          tb.createIndex("byStart", "startTime");
          tb.createIndex("byTask", "taskId");

          db.createObjectStore("projects", { keyPath: "id" });
          db.createObjectStore("goals", { keyPath: "id" });

          const ses = db.createObjectStore("sessions", { keyPath: "id" });
          ses.createIndex("byStart", "startTime");
          ses.createIndex("byTask", "taskId");

          db.createObjectStore("tags", { keyPath: "id" });

          const logs = db.createObjectStore("logs", { keyPath: "id" });
          logs.createIndex("byDate", "date");

          db.createObjectStore("snapshots", { keyPath: "id" });
          db.createObjectStore("settings", { keyPath: "id" });
        }
        if (oldVersion < 2) {
          db.createObjectStore("accounts", { keyPath: "id" });

          const tx = db.createObjectStore("transactions", { keyPath: "id" });
          tx.createIndex("byDate", "date");
          tx.createIndex("byAccount", "accountId");
          tx.createIndex("byCategory", "categoryId");

          const cats = db.createObjectStore("categories", { keyPath: "id" });
          cats.createIndex("byType", "type");

          const budgets = db.createObjectStore("budgets", { keyPath: "id" });
          budgets.createIndex("byCategory", "categoryId");

          db.createObjectStore("savingsGoals", { keyPath: "id" });
        }
        if (oldVersion < 3) {
          const notes = db.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("byUpdated", "updatedAt");
          notes.createIndex("byStatus", "status");
        }
      },
    });
  }
  return dbPromise;
}

// Generic CRUD helpers
type Stores =
  | "tasks" | "timeBlocks" | "projects" | "goals" | "sessions" | "tags" | "logs" | "snapshots" | "settings"
  | "accounts" | "transactions" | "categories" | "budgets" | "savingsGoals" | "notes";

export async function getAll<T>(store: Stores): Promise<T[]> {
  const db = await getDB();
  return (await db.getAll(store as any)) as T[];
}

export async function getOne<T>(store: Stores, id: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get(store as any, id)) as T | undefined;
}

export async function putOne<T extends { id: string }>(store: Stores, value: T): Promise<T> {
  const db = await getDB();
  await db.put(store as any, value as any);
  return value;
}

export async function delOne(store: Stores, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(store as any, id);
}

const ALL_STORES: Stores[] = [
  "tasks", "timeBlocks", "projects", "goals", "sessions", "tags", "logs", "snapshots", "settings",
  "accounts", "transactions", "categories", "budgets", "savingsGoals", "notes",
];

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await Promise.all(ALL_STORES.map((s) => db.clear(s as any)));
}

export async function exportAll() {
  const entries = await Promise.all(ALL_STORES.map(async (s) => [s, await getAll(s)] as const));
  const data: Record<string, any> = { version: 2, exportedAt: Date.now() };
  for (const [s, v] of entries) data[s] = v;
  return data;
}

export async function importAll(data: any) {
  const db = await getDB();
  for (const s of ALL_STORES) {
    if (Array.isArray(data[s])) {
      const tx = db.transaction(s as any, "readwrite");
      await tx.store.clear();
      for (const item of data[s]) await tx.store.put(item);
      await tx.done;
    }
  }
}

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
