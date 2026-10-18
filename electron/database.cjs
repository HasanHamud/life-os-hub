const Database = require("better-sqlite3");
const path = require("path");

let db;

function getDbPath() {
  const { app } = require("electron");
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "life-os.db");
}

const TABLES = [
  "tasks", "timeBlocks", "projects", "goals", "sessions", "tags", "logs", "settings",
  "accounts", "transactions", "categories", "budgets", "savingsGoals", "notes",
  "concepts", "insights", "problems", "learningSessions", "rotationEntries",
  "weeklyPlans", "weekTemplates", "snapshots",
];

const TABLE_SCHEMAS = {
  tasks: `create table if not exists tasks (
    id text primary key,
    title text not null default 'Untitled',
    description text,
    status text not null default 'todo',
    priority text not null default 'med',
    effort integer,
    deadline real,
    projectId text,
    goalId text,
    tagIds text default '[]',
    parentTaskId text,
    dependsOnIds text default '[]',
    recurrence text,
    recurrenceParentId text,
    archived integer default 0,
    completedAt real,
    createdAt real not null,
    updatedAt real not null
  )`,
  timeBlocks: `create table if not exists timeBlocks (
    id text primary key,
    taskId text,
    title text not null default 'Time Block',
    startTime real not null,
    endTime real not null,
    type text not null default 'work',
    isCompleted integer default 0,
    notes text,
    recurrence text,
    recurrenceParentId text,
    createdAt real not null
  )`,
  projects: `create table if not exists projects (
    id text primary key,
    name text not null default 'Untitled Project',
    description text,
    color text default '#d4a574',
    category text,
    archived integer default 0,
    createdAt real not null
  )`,
  goals: `create table if not exists goals (
    id text primary key,
    title text not null default 'Untitled Goal',
    description text,
    durationDays integer not null default 30,
    startDate real not null,
    endDate real not null,
    linkedTaskIds text default '[]',
    createdAt real not null
  )`,
  sessions: `create table if not exists sessions (
    id text primary key,
    taskId text,
    projectId text,
    startTime real not null,
    endTime real not null,
    duration integer not null,
    type text not null,
    notes text
  )`,
  tags: `create table if not exists tags (
    id text primary key,
    name text not null,
    color text not null default '#d4a574'
  )`,
  logs: `create table if not exists logs (
    id text primary key,
    date text not null,
    content text not null default '',
    relatedTaskId text,
    mood integer,
    energy integer,
    createdAt real not null
  )`,
  settings: `create table if not exists settings (
    id text primary key default 'global',
    pomodoroFocus integer not null default 25,
    pomodoroBreak integer not null default 5,
    pomodoroLongBreak integer not null default 15,
    pomodoroLongEvery integer not null default 4,
    notificationsEnabled integer default 0,
    workdayStart integer not null default 8,
    workdayEnd integer not null default 20,
    baseCurrency text not null default 'USD',
    usdToLbpRate real not null default 90000
  )`,
  accounts: `create table if not exists accounts (
    id text primary key,
    name text not null,
    type text not null,
    initialBalance real not null default 0,
    balance real not null default 0,
    currency text not null default 'USD',
    color text default '#d4a574',
    archived integer default 0,
    createdAt real not null
  )`,
  transactions: `create table if not exists transactions (
    id text primary key,
    type text not null,
    amount real not null,
    categoryId text,
    accountId text not null,
    toAccountId text,
    date real not null,
    note text,
    relatedTaskId text,
    relatedGoalId text,
    recurrence text,
    recurrenceParentId text,
    createdAt real not null
  )`,
  categories: `create table if not exists categories (
    id text primary key,
    name text not null,
    type text not null,
    parentCategoryId text,
    color text default '#d4a574',
    icon text,
    createdAt real not null
  )`,
  budgets: `create table if not exists budgets (
    id text primary key,
    categoryId text not null,
    limitAmount real not null,
    period text not null default 'monthly',
    startDate real not null,
    createdAt real not null
  )`,
  savingsGoals: `create table if not exists savingsGoals (
    id text primary key,
    title text not null,
    targetAmount real not null,
    currentAmount real not null default 0,
    currency text default 'USD',
    deadline real,
    linkedGoalId text,
    accountId text,
    color text default '#90b890',
    createdAt real not null
  )`,
  notes: `create table if not exists notes (
    id text primary key,
    title text not null default 'Untitled',
    content text not null default '',
    type text not null default 'text',
    status text not null default 'active',
    category text,
    tagIds text default '[]',
    priority text,
    favorite integer default 0,
    pinned integer default 0,
    color text,
    icon text,
    projectId text,
    language text,
    attachments text default '[]',
    isTemplate integer default 0,
    createdAt real not null,
    updatedAt real not null,
    trashedAt real
  )`,
  concepts: `create table if not exists concepts (
    id text primary key,
    subject text not null default '',
    topic text not null default '',
    title text not null default 'Untitled',
    phase integer not null default 1,
    clarityRating integer not null default 1,
    canExplainWithoutNotes integer default 0,
    notes text,
    resourceLinks text default '[]',
    tags text default '[]',
    problemIds text default '[]',
    createdAt real not null,
    updatedAt real not null
  )`,
  insights: `create table if not exists insights (
    id text primary key,
    subject text not null default '',
    topic text not null default '',
    keyIdea text not null,
    insights text default '[]',
    mistakes text,
    conceptId text,
    problemId text,
    tags text default '[]',
    date text not null,
    nextReviewAt real,
    reviewCount integer default 0,
    createdAt real not null
  )`,
  problems: `create table if not exists problems (
    id text primary key,
    title text not null default 'Untitled',
    subject text not null default '',
    source text,
    difficulty integer default 1,
    patternClass text,
    timeToSolve integer,
    notes text,
    tags text default '[]',
    completed integer default 0,
    completedAt real,
    createdAt real not null
  )`,
  learningSessions: `create table if not exists learningSessions (
    id text primary key,
    subject text not null default '',
    topic text not null default '',
    date text not null,
    duration integer not null default 0,
    completedSteps text default '[]',
    conceptId text,
    insightId text,
    problemId text,
    createdAt real not null
  )`,
  rotationEntries: `create table if not exists rotationEntries (
    id text primary key,
    dayOfWeek integer not null,
    subject text not null,
    topic text not null default '',
    icon text,
    enabled integer default 1
  )`,
  weeklyPlans: `create table if not exists weeklyPlans (
    id text primary key,
    weekStart real not null,
    intention text default '',
    goals text default '[]',
    categories text default '["Work","Freelance","Personal","Studies","University"]',
    categoryNotes text default '{}',
    notes text default '',
    reflection text,
    createdAt real not null,
    updatedAt real not null
  )`,
  weekTemplates: `create table if not exists weekTemplates (
    id text primary key,
    name text not null default 'Untitled Template',
    days text default '[]',
    createdAt real not null
  )`,
  snapshots: `create table if not exists snapshots (
    id text primary key,
    name text not null,
    createdAt real not null,
    data text not null
  )`,
};

function openAt(dbPath) {
  if (db) {
    try { db.close(); } catch {}
    db = null;
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  for (const schema of Object.values(TABLE_SCHEMAS)) {
    db.exec(schema);
  }

  db.exec(`create table if not exists app_config (
    key text primary key,
    value text not null
  )`);

  return db;
}

function initDatabase() {
  return openAt(getDbPath());
}

function getAll(store) {
  const rows = db.prepare(`select * from ${store}`).all();
  return rows.map(parseRow);
}

function getOne(store, id) {
  const row = db.prepare(`select * from ${store} where id = ?`).get(id);
  return row ? parseRow(row) : undefined;
}

function putOne(store, value) {
  const existing = db.prepare(`select id from ${store} where id = ?`).get(value.id);
  if (existing) {
    const keys = Object.keys(value);
    const setClause = keys.filter((k) => k !== "id").map((k) => `${k} = ?`).join(", ");
    const vals = keys.filter((k) => k !== "id").map((k) => serializeValue(value[k]));
    db.prepare(`update ${store} set ${setClause} where id = ?`).run(...vals, value.id);
  } else {
    const keys = Object.keys(value);
    const placeholders = keys.map(() => "?").join(", ");
    const vals = keys.map((k) => serializeValue(value[k]));
    db.prepare(`insert into ${store} (${keys.join(", ")}) values (${placeholders})`).run(...vals);
  }
  return value;
}

function delOne(store, id) {
  db.prepare(`delete from ${store} where id = ?`).run(id);
}

function clearAll() {
  for (const table of TABLES) {
    db.prepare(`delete from ${table}`).run();
  }
}

function clearStore(store) {
  if (TABLES.includes(store)) {
    db.prepare(`delete from ${store}`).run();
  }
}

function exportAll() {
  const data = { version: 2, exportedAt: Date.now() };
  for (const table of TABLES) {
    data[table] = getAll(table);
  }
  return data;
}

function importAll(data) {
  for (const table of TABLES) {
    const items = data[table];
    if (Array.isArray(items) && items.length > 0) {
      const insert = db.transaction((rows) => {
        for (const row of rows) {
          putOne(table, row);
        }
      });
      insert(items);
    }
  }
}

function getConfig(key) {
  const row = db.prepare("select value from app_config where key = ?").get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  db.prepare(
    "insert into app_config (key, value) values (?, ?) on conflict(key) do update set value = excluded.value"
  ).run(key, value);
}

function parseRow(row) {
  const parsed = {};
  for (const [key, val] of Object.entries(row)) {
    parsed[key] = deserializeValue(val);
  }
  return parsed;
}

function serializeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (Array.isArray(val) || (typeof val === "object" && !(val instanceof Date))) {
    return JSON.stringify(val);
  }
  return val;
}

function deserializeValue(val) {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
        return parsed;
      }
    } catch {}
    return val;
  }
  return val;
}

module.exports = { initDatabase, openAt, getAll, getOne, putOne, delOne, clearAll, clearStore, exportAll, importAll, getConfig, setConfig };
