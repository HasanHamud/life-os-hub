import { supabase } from "./supabase";

let currentUserId: string | null = null;

export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

const TABLE_MAP: Record<string, string> = {
  tasks: "tasks",
  timeBlocks: "time_blocks",
  projects: "projects",
  goals: "goals",
  sessions: "sessions",
  tags: "tags",
  logs: "logs",
  settings: "settings",
  accounts: "accounts",
  transactions: "transactions",
  categories: "categories",
  budgets: "budgets",
  savingsGoals: "savings_goals",
  notes: "notes",
  concepts: "concepts",
  insights: "insights",
  problems: "problems",
  learningSessions: "learning_sessions",
  rotationEntries: "rotation_entries",
  weeklyPlans: "weekly_plans",
  weekTemplates: "week_templates",
};

type Stores = keyof typeof TABLE_MAP;

function tableName(store: Stores): string {
  return TABLE_MAP[store];
}

function camelToSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[camelToSnakeKey(key)] = obj[key];
  }
  return result;
}

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[snakeToCamelKey(key)] = obj[key];
  }
  return result;
}

export async function getAll<T>(store: Stores): Promise<T[]> {
  const userId = getCurrentUserId();
  if (!userId) return [];
  const table = tableName(store);
  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId);
  return ((data ?? []) as any[]).map((row) => toCamelCase(row)) as T[];
}

export async function getOne<T>(store: Stores, id: string): Promise<T | undefined> {
  const userId = getCurrentUserId();
  if (!userId) return undefined;
  const table = tableName(store);
  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return undefined;
  return toCamelCase(data as any) as T;
}

export async function putOne<T extends { id: string }>(store: Stores, value: T): Promise<T> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const table = tableName(store);
  const snake = toSnakeCase(value as any);
  const payload = { ...snake, user_id: userId };
  const { error } = await supabase.from(table).upsert(payload);
  if (error) {
    console.error(`putOne error [${table}]:`, error.message, error.details, error.hint);
    throw error;
  }
  return value;
}

export async function delOne(store: Stores, id: string): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  const table = tableName(store);
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

const ALL_STORES: Stores[] = [
  "tasks", "timeBlocks", "projects", "goals", "sessions", "tags", "logs", "settings",
  "accounts", "transactions", "categories", "budgets", "savingsGoals", "notes",
  "concepts", "insights", "problems", "learningSessions", "rotationEntries",
  "weeklyPlans", "weekTemplates",
];

export async function clearAll(): Promise<void> {
  const userId = getCurrentUserId();
  if (!userId) return;
  for (const store of ALL_STORES) {
    const table = tableName(store);
    await supabase.from(table).delete().eq("user_id", userId);
  }
}

export async function exportAll() {
  const entries = await Promise.all(ALL_STORES.map(async (s) => [s, await getAll(s)] as const));
  const data: Record<string, any> = { version: 2, exportedAt: Date.now() };
  for (const [s, v] of entries) data[s] = v;
  return data;
}

export async function importAll(data: any) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  for (const store of ALL_STORES) {
    const items = data[store];
    if (Array.isArray(items) && items.length > 0) {
      const table = tableName(store);
      const rows = items.map((item: any) => ({ ...toSnakeCase(item), user_id: userId }));
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw error;
    }
  }
}

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
