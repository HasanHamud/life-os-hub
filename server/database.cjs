const { AsyncLocalStorage } = require("async_hooks");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const fs = require("fs");
const os = require("os");
const path = require("path");
const auth = require("./auth.cjs");

const userScope = new AsyncLocalStorage();
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
let dummyPassword = null;

let db;

function candidateDataDirs() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return [path.join(appData, "life-os-hub"), path.join(appData, "Life OS Hub")];
  }
  if (process.platform === "darwin") {
    const base = path.join(os.homedir(), "Library", "Application Support");
    return [path.join(base, "life-os-hub"), path.join(base, "Life OS Hub")];
  }
  const config = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return [path.join(config, "life-os-hub"), path.join(config, "Life OS Hub")];
}

function getDataDir() {
  const existing = candidateDataDirs()
    .map((dir) => ({ dir, file: path.join(dir, "life-os.db") }))
    .filter((entry) => fs.existsSync(entry.file))
    .sort((a, b) => fs.statSync(b.file).mtimeMs - fs.statSync(a.file).mtimeMs);
  return existing[0]?.dir || candidateDataDirs()[0];
}

function getDbPath() {
  if (process.env.LIFE_OS_DB) return path.resolve(process.env.LIFE_OS_DB);
  return path.join(getDataDir(), "life-os.db");
}

function assertStore(store) {
  if (!TABLES.includes(store)) throw new Error("Unknown store");
}

function assertIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid column");
}

const TABLES = [
  "tasks", "projects", "goals", "sessions", "tags", "logs", "settings",
  "accounts", "transactions", "categories", "budgets", "savingsGoals", "notes",
  "concepts", "insights", "problems", "learningSessions", "rotationEntries",
  "weeklyPlans", "weekTemplates", "snapshots",
];

const FINANCE_STORES = ["accounts", "transactions", "categories", "budgets", "savingsGoals"];

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
    assigneeId text,
    recurrence text,
    recurrenceParentId text,
    archived integer default 0,
    completedAt real,
    createdAt real not null,
    updatedAt real not null
  )`,
  projects: `create table if not exists projects (
    id text primary key,
    name text not null default 'Untitled Project',
    description text,
    color text default '#d4a574',
    category text,
    managerId text,
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
    relatedTaskIds text,
    mood integer,
    energy integer,
    createdAt real not null
  )`,
  settings: `create table if not exists settings (
    id text primary key default 'global',
    locale text not null default 'en',
    theme text not null default 'warm-dark',
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
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  for (const schema of Object.values(TABLE_SCHEMAS)) {
    db.exec(schema);
  }

  const settingsColumns = db.prepare("pragma table_info(settings)").all();
  if (!settingsColumns.some((column) => column.name === "locale")) {
    db.exec("alter table settings add column locale text not null default 'en'");
  }
  if (!settingsColumns.some((column) => column.name === "theme")) {
    db.exec("alter table settings add column theme text not null default 'warm-dark'");
  }
  if (!settingsColumns.some((column) => column.name === "financeEnabled")) {
    db.exec("alter table settings add column financeEnabled integer not null default 0");
  }

  db.exec(`create table if not exists app_config (
    key text primary key,
    value text not null
  )`);
  db.exec(`create table if not exists users (
    id text primary key,
    name text not null,
    email text not null unique,
    passwordHash text not null,
    passwordSalt text not null,
    role text not null,
    active integer not null default 1,
    createdAt real not null
  )`);
  const userColumns = db.prepare("pragma table_info(users)").all();
  if (!userColumns.some((column) => column.name === "avatar")) {
    db.exec("alter table users add column avatar text");
  }
  db.exec(`create table if not exists auth_sessions (
    tokenHash text primary key,
    userId text not null,
    expiresAt real not null
  )`);
  db.exec(`create table if not exists user_config (
    userId text not null,
    key text not null,
    value text not null,
    primary key (userId, key)
  )`);

  for (const table of TABLES) {
    const columns = db.prepare(`pragma table_info(${table})`).all();
    if (!columns.some((column) => column.name === "userId")) {
      db.exec(`alter table ${table} add column userId text`);
    }
  }

  const taskColumns = db.prepare("pragma table_info(tasks)").all();
  if (!taskColumns.some((column) => column.name === "assigneeId")) {
    db.exec("alter table tasks add column assigneeId text");
  }
  if (!taskColumns.some((column) => column.name === "createdBy")) {
    db.exec("alter table tasks add column createdBy text");
  }
  const projectColumns = db.prepare("pragma table_info(projects)").all();
  if (!projectColumns.some((column) => column.name === "managerId")) {
    db.exec("alter table projects add column managerId text");
  }
  if (!projectColumns.some((column) => column.name === "memberIds")) {
    db.exec("alter table projects add column memberIds text");
  }

  const logColumns = db.prepare("pragma table_info(logs)").all();
  if (!logColumns.some((column) => column.name === "relatedTaskIds")) {
    db.exec("alter table logs add column relatedTaskIds text");
  }
  if (!logColumns.some((column) => column.name === "adminNote")) {
    db.exec("alter table logs add column adminNote text");
  }
  if (!logColumns.some((column) => column.name === "adminNoteAt")) {
    db.exec("alter table logs add column adminNoteAt real");
  }
  if (!logColumns.some((column) => column.name === "adminNoteBy")) {
    db.exec("alter table logs add column adminNoteBy text");
  }
  db.exec(`update logs set relatedTaskIds = json_array(relatedTaskId)
    where relatedTaskId is not null and relatedTaskIds is null`);

  db.exec(`create table if not exists activity (
    id text primary key,
    userId text not null,
    actorId text not null,
    area text not null,
    action text not null,
    count integer not null default 1,
    at real not null
  )`);
  db.exec("create index if not exists activity_lookup on activity (userId, actorId, area, action, at)");

  db.exec(`create table if not exists notifications (
    id text primary key,
    userId text not null,
    actorId text not null,
    actorName text not null,
    kind text not null,
    subject text not null default '',
    count integer not null default 1,
    href text not null,
    readAt real,
    createdAt real not null
  )`);
  db.exec("create index if not exists notifications_user on notifications (userId, createdAt)");
  pruneActivity();

  return db;
}

const ACTIVITY_WINDOW = 10 * 60 * 1000;
const ACTIVITY_KEEP = 2000;
const ACTIVITY_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const NOTICE_WINDOW = 2 * 60 * 1000;

let workspaceListener = () => {};

function onWorkspaceEvent(fn) {
  workspaceListener = fn;
}

function emitWorkspace(event) {
  workspaceListener(event);
}

function clipSubject(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function withUser(userId, fn, actorId) {
  return userScope.run({ userId, actorId: actorId || userId, quiet: false }, fn);
}

function currentUserId() {
  const scoped = userScope.getStore();
  if (scoped && scoped.userId) return scoped.userId;
  throw new Error("No workspace");
}

function currentActorId() {
  const scoped = userScope.getStore();
  if (scoped && scoped.userId) return scoped.actorId || scoped.userId;
  throw new Error("No workspace");
}

function recordActivity(userId, actorId, area, action) {
  const scoped = userScope.getStore();
  if (scoped && scoped.quiet) return;
  const now = Date.now();
  const recent = db.prepare(
    `select id from activity
     where userId = ? and actorId = ? and area = ? and action = ? and at >= ?
     order by at desc limit 1`
  ).get(userId, actorId, area, action, now - ACTIVITY_WINDOW);
  if (recent) {
    db.prepare("update activity set at = ?, count = count + 1 where id = ?").run(now, recent.id);
  } else {
    db.prepare(
      "insert into activity (id, userId, actorId, area, action, count, at) values (?, ?, ?, ?, ?, 1, ?)"
    ).run(crypto.randomUUID(), userId, actorId, area, action, now);
  }
  pruneActivity();
}

function pruneActivity() {
  db.prepare("delete from activity where at < ?").run(Date.now() - ACTIVITY_MAX_AGE);
  const extra = db.prepare("select count(*) as n from activity").get().n - ACTIVITY_KEEP;
  if (extra > 0) {
    db.prepare(
      "delete from activity where id in (select id from activity order by at asc limit ?)"
    ).run(extra);
  }
}

function dayStart(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) throw new Error("Pick a valid date");
  const [year, month, date] = String(day).split("-").map(Number);
  const start = new Date(year, month - 1, date);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== date) {
    throw new Error("Pick a valid date");
  }
  return start.getTime();
}

function deleteActivityRange(fromDay, toDay) {
  const start = dayStart(fromDay);
  const end = dayStart(toDay);
  if (end < start) throw new Error("The end date is before the start date");
  // shortcut: fixed 24h after local midnight, upgrade if a DST day must match the calendar exactly
  const result = db.prepare("delete from activity where at >= ? and at < ?").run(start, end + 24 * 60 * 60 * 1000);
  return { deleted: result.changes };
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: !!row.active,
    createdAt: row.createdAt,
    avatar: row.avatar || null,
  };
}

function needsSetup() {
  return db.prepare("select count(*) as n from users").get().n === 0;
}

function initDatabase() {
  return openAt(getDbPath());
}

function ownedId(store, id) {
  return store === "settings" ? currentUserId() : id;
}

function viewingOtherFinance() {
  return currentActorId() !== currentUserId();
}

function denyOtherFinance(store) {
  if (!viewingOtherFinance() || !FINANCE_STORES.includes(store)) return;
  const error = new Error("Not found");
  error.status = 404;
  throw error;
}

function withoutFinance(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const copy = { ...value };
  for (const store of FINANCE_STORES) delete copy[store];
  return copy;
}

function redactSnapshot(row) {
  if (!viewingOtherFinance() || !row) return row;
  if (typeof row.data === "string") {
    try {
      return { ...row, data: JSON.stringify(withoutFinance(JSON.parse(row.data))) };
    } catch {
      return row;
    }
  }
  if (row.data && typeof row.data === "object") return { ...row, data: withoutFinance(row.data) };
  return row;
}

function userRole(userId) {
  const row = db.prepare("select role from users where id = ?").get(userId);
  return row ? row.role : "member";
}

function actorIsAdmin() {
  return userRole(currentActorId()) === "admin";
}

function managerView() {
  return userRole(currentUserId()) === "admin" && currentActorId() === currentUserId();
}

function assignedMembers(row) {
  if (!row) return [];
  let ids = row.memberIds;
  if (typeof ids === "string") {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  if (!Array.isArray(ids)) ids = [];
  ids = ids.filter((id) => typeof id === "string" && id);
  if (ids.length) return ids;
  return row.managerId ? [row.managerId] : [];
}

function cleanMemberIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && id))];
}

function memberAccountIds() {
  return db.prepare("select id from users where role = 'member'").all().map((row) => row.id);
}

function rowsByUserIds(store, ids) {
  if (!ids.length) return [];
  return db.prepare(`select * from ${store} where userId in (${ids.map(() => "?").join(",")})`).all(...ids);
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(parseRow(row));
  }
  return out;
}

function visibleProjectRows() {
  const userId = currentUserId();
  const owned = db.prepare("select * from projects where userId = ?").all(userId);
  const extra = managerView()
    ? rowsByUserIds("projects", memberAccountIds())
    : db.prepare("select * from projects where userId != ?").all(userId)
      .filter((row) => assignedMembers(row).includes(userId));
  return dedupeRows(owned.concat(extra));
}

function visibleTaskRows() {
  const userId = currentUserId();
  const owned = db.prepare("select * from tasks where userId = ?").all(userId);
  let extra = [];
  if (managerView()) {
    extra = rowsByUserIds("tasks", memberAccountIds());
  } else {
    const projectIds = visibleProjectRows()
      .filter((project) => project.userId !== userId)
      .map((project) => project.id);
    if (projectIds.length) {
      extra = db.prepare(
        `select * from tasks where projectId in (${projectIds.map(() => "?").join(",")})`
      ).all(...projectIds);
    }
  }
  const rows = owned.concat(extra);
  const seen = new Set(rows.map((row) => row.id));
  const parents = new Map(rows.map((row) => [row.id, row]));
  const parentIds = [...seen];
  if (parentIds.length) {
    const children = db.prepare(
      `select * from tasks where parentTaskId in (${parentIds.map(() => "?").join(",")})`
    ).all(...parentIds);
    for (const child of children) {
      const parent = parents.get(child.parentTaskId);
      if (!parent || seen.has(child.id)) continue;
      if (child.userId !== parent.userId && child.projectId !== parent.projectId) continue;
      seen.add(child.id);
      rows.push(child);
    }
  }
  return dedupeRows(rows);
}

function canWriteTask(row) {
  if (!row) return false;
  if (actorIsAdmin()) return true;
  const actor = currentActorId();
  if (row.userId === actor || row.userId === currentUserId()) return true;
  if (!row.projectId) return false;
  const project = db.prepare("select * from projects where id = ?").get(row.projectId);
  return !!project && (project.userId === actor || assignedMembers(project).includes(actor));
}

function notifyShare(store, row) {
  const scoped = userScope.getStore();
  if (scoped && scoped.quiet) return;
  if (store !== "tasks" && store !== "projects") return;
  const ids = new Set();
  if (row.userId) ids.add(row.userId);
  for (const admin of db.prepare("select id from users where role = 'admin' and active = 1").all()) {
    ids.add(admin.id);
  }
  if (store === "projects") {
    for (const id of assignedMembers(row)) ids.add(id);
  }
  if (store === "tasks") {
    if (row.createdBy) ids.add(row.createdBy);
    if (row.projectId) {
      const project = db.prepare("select * from projects where id = ?").get(row.projectId);
      if (project) {
        if (project.userId) ids.add(project.userId);
        for (const id of assignedMembers(project)) ids.add(id);
      }
    }
  }
  emitWorkspace({ type: "changed", userIds: [...ids] });
}

function getAll(store, ownedOnly = false) {
  assertStore(store);
  if (viewingOtherFinance() && FINANCE_STORES.includes(store)) return [];
  if (!ownedOnly && store === "projects") return visibleProjectRows();
  if (!ownedOnly && store === "tasks") return visibleTaskRows();
  const rows = db.prepare(`select * from ${store} where userId = ?`).all(currentUserId()).map(parseRow);
  return store === "snapshots" ? rows.map(redactSnapshot) : rows;
}

function getOne(store, id) {
  assertStore(store);
  denyOtherFinance(store);
  if (store === "projects") return visibleProjectRows().find((row) => row.id === id);
  if (store === "tasks") return visibleTaskRows().find((row) => row.id === id);
  const row = db.prepare(`select * from ${store} where id = ? and userId = ?`).get(ownedId(store, id), currentUserId());
  return row ? redactSnapshot(parseRow(row)) : undefined;
}

function putOne(store, value) {
  assertStore(store);
  denyOtherFinance(store);
  if (!value || typeof value.id !== "string" || !value.id) throw new Error("Row id is required");
  const userId = currentUserId();
  const row = { ...value, userId };
  if (store === "settings") {
    row.id = userId;
    if (viewingOtherFinance()) {
      const current = db.prepare("select financeEnabled from settings where id = ?").get(userId);
      if (current) row.financeEnabled = current.financeEnabled;
    }
  }
  if (store === "logs") {
    delete row.adminNote;
    delete row.adminNoteAt;
    delete row.adminNoteBy;
  }
  const existing = (store === "tasks" || store === "logs" || store === "projects")
    ? db.prepare(`select * from ${store} where id = ?`).get(row.id)
    : db.prepare(`select userId from ${store} where id = ?`).get(row.id);
  if (store === "projects") {
    if (existing && existing.userId !== userId) {
      if (!(actorIsAdmin() && currentActorId() === currentUserId())) throw new Error("Not found");
      row.userId = existing.userId;
    }
    if (actorIsAdmin()) {
      row.managerId = currentActorId();
      row.memberIds = Array.isArray(value.memberIds) ? cleanMemberIds(value.memberIds) : assignedMembers(existing);
    } else if (existing) {
      row.memberIds = assignedMembers(existing);
      row.managerId = existing.managerId || null;
    } else {
      row.memberIds = [];
      row.managerId = null;
    }
  }
  if (store === "tasks") {
    if (!existing) row.createdBy = currentActorId();
    else row.createdBy = existing.createdBy || null;
    if (row.projectId) {
      const project = db.prepare("select * from projects where id = ?").get(row.projectId);
      if (!project) throw new Error("Unknown project");
      const actor = currentActorId();
      if (!actorIsAdmin() && project.userId !== actor && !assignedMembers(project).includes(actor)) {
        const error = new Error("Forbidden");
        error.status = 403;
        throw error;
      }
      row.userId = project.userId;
    } else if (existing && existing.userId !== userId) {
      if (!(actorIsAdmin() && currentActorId() === currentUserId())) throw new Error("Not found");
      row.userId = existing.userId;
    }
    if (existing && !canWriteTask(existing)) throw new Error("Not found");
  }
  // shortcut: an import keeps its ids, so a row already owned by someone else is rejected
  if (store !== "tasks" && store !== "projects" && existing && existing.userId !== userId) throw new Error("Not found");
  const keys = Object.keys(row);
  for (const key of keys) assertIdent(key);
  if (existing) {
    const setKeys = keys.filter((k) => k !== "id");
    const setClause = setKeys.map((k) => `${k} = ?`).join(", ");
    const vals = setKeys.map((k) => serializeValue(row[k]));
    db.prepare(`update ${store} set ${setClause} where id = ? and userId = ?`).run(...vals, row.id, existing.userId);
  } else {
    const placeholders = keys.map(() => "?").join(", ");
    const vals = keys.map((k) => serializeValue(row[k]));
    db.prepare(`insert into ${store} (${keys.join(", ")}) values (${placeholders})`).run(...vals);
  }
  recordActivity(row.userId, currentActorId(), store, existing ? "updated" : "created");
  maybeNotify(store, existing, row);
  notifyShare(store, row);
  return row;
}

function writeNotice(recipientId, actor, kind, subject, href, coalesce) {
  const now = Date.now();
  if (coalesce) {
    const recent = db.prepare(
      `select id, count from notifications
       where userId = ? and actorId = ? and kind = ? and readAt is null and createdAt >= ?
       order by createdAt desc limit 1`
    ).get(recipientId, actor.id, kind, now - NOTICE_WINDOW);
    if (recent) {
      db.prepare(
        "update notifications set subject = ?, count = ?, href = ?, createdAt = ? where id = ?"
      ).run(subject, recent.count + 1, href, now, recent.id);
      return;
    }
  }
  db.prepare(
    `insert into notifications
      (id, userId, actorId, actorName, kind, subject, count, href, readAt, createdAt)
     values (?, ?, ?, ?, ?, ?, 1, ?, null, ?)`
  ).run(crypto.randomUUID(), recipientId, actor.id, actor.name, kind, subject, href, now);
}

function notifyAdmins(kind, subject, href, coalesce) {
  const scoped = userScope.getStore();
  if (scoped && scoped.quiet) return;
  const actor = db.prepare("select id, name, role from users where id = ?").get(currentActorId());
  if (!actor || actor.role === "admin") return;
  const admins = db.prepare(
    "select id from users where role = 'admin' and active = 1 and id != ?"
  ).all(actor.id);
  if (!admins.length) return;
  for (const admin of admins) writeNotice(admin.id, actor, kind, subject, href, coalesce);
  emitWorkspace({ type: "notification", userIds: admins.map((admin) => admin.id) });
}

function maybeNotify(store, previous, row) {
  if (store === "logs" && !previous) notifyAdmins("journal_added", String(row.date || ""), "/journal", false);
  if (store !== "tasks") return;
  const title = clipSubject(row.title);
  if (!previous) notifyAdmins("task_created", title, `/tasks/${row.id}`, false);
  else if (previous.status !== row.status) notifyAdmins("task_moved", title, "/tasks", true);
}

function listNotifications(userId) {
  const items = db.prepare(
    `select id, actorId, actorName, kind, subject, count, href, readAt, createdAt
     from notifications where userId = ? order by createdAt desc limit 30`
  ).all(userId);
  const unread = db.prepare(
    "select count(*) as n from notifications where userId = ? and readAt is null"
  ).get(userId).n;
  return { items, unread };
}

function markNotificationRead(userId, id) {
  db.prepare(
    "update notifications set readAt = ? where id = ? and userId = ? and readAt is null"
  ).run(Date.now(), id, userId);
}

function markAllNotificationsRead(userId) {
  db.prepare(
    "update notifications set readAt = ? where userId = ? and readAt is null"
  ).run(Date.now(), userId);
}

function delOne(store, id) {
  assertStore(store);
  denyOtherFinance(store);
  if (store === "tasks" || store === "projects") {
    const rows = store === "tasks" ? visibleTaskRows() : visibleProjectRows();
    const row = rows.find((item) => item.id === id);
    if (!row) throw new Error("Not found");
    if (store === "projects" && row.userId !== currentUserId() && !actorIsAdmin()) throw new Error("Not found");
    if (store === "tasks" && !canWriteTask(row)) throw new Error("Not found");
    const result = db.prepare(`delete from ${store} where id = ? and userId = ?`).run(id, row.userId);
    if (result.changes) {
      recordActivity(row.userId, currentActorId(), store, "deleted");
      notifyShare(store, row);
    }
    return;
  }
  const userId = currentUserId();
  const result = db.prepare(`delete from ${store} where id = ? and userId = ?`).run(ownedId(store, id), userId);
  if (result.changes) recordActivity(userId, currentActorId(), store, "deleted");
}

function clearAll() {
  const userId = currentUserId();
  const hidden = viewingOtherFinance();
  for (const table of TABLES) {
    if (hidden && FINANCE_STORES.includes(table)) continue;
    db.prepare(`delete from ${table} where userId = ?`).run(userId);
  }
  db.prepare("delete from user_config where userId = ?").run(userId);
  recordActivity(userId, currentActorId(), "workspace", "cleared");
}

function clearStore(store) {
  assertStore(store);
  denyOtherFinance(store);
  const userId = currentUserId();
  db.prepare(`delete from ${store} where userId = ?`).run(userId);
  recordActivity(userId, currentActorId(), store, "cleared");
}

function exportAll() {
  const data = { version: 2, exportedAt: Date.now() };
  const hidden = viewingOtherFinance();
  for (const table of TABLES) {
    if (hidden && FINANCE_STORES.includes(table)) continue;
    data[table] = getAll(table, true);
  }
  return data;
}

function importAll(data) {
  const scoped = userScope.getStore();
  const previous = scoped ? scoped.quiet : false;
  if (scoped) scoped.quiet = true;
  try {
    const hidden = viewingOtherFinance();
    for (const table of TABLES) {
      if (hidden && FINANCE_STORES.includes(table)) continue;
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
  } finally {
    if (scoped) scoped.quiet = previous;
  }
  recordActivity(currentUserId(), currentActorId(), "workspace", "imported");
}

function getConfig(key) {
  const row = db.prepare("select value from user_config where userId = ? and key = ?").get(currentUserId(), key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  db.prepare(
    "insert into user_config (userId, key, value) values (?, ?, ?) on conflict(userId, key) do update set value = excluded.value"
  ).run(currentUserId(), key, value);
}

function claimExistingData(adminId) {
  for (const table of TABLES) {
    if (table === "settings") continue;
    db.prepare(`update ${table} set userId = ? where userId is null or userId = ''`).run(adminId);
  }
  const global = db.prepare("select * from settings where id = 'global'").get();
  if (global) {
    const mine = db.prepare("select id from settings where id = ?").get(adminId);
    if (!mine) {
      const cols = Object.keys(global).filter((key) => key !== "id");
      const values = cols.map((key) => (key === "userId" ? adminId : global[key]));
      db.prepare(
        `insert into settings (id, ${cols.join(", ")}) values (${["?"].concat(cols.map(() => "?")).join(", ")})`
      ).run(adminId, ...values);
    }
    db.prepare("delete from settings where id = 'global'").run();
  }
  db.prepare("update settings set userId = ? where userId is null or userId = ''").run(adminId);
  const configs = db.prepare("select key, value from app_config").all();
  for (const row of configs) {
    db.prepare(
      "insert into user_config (userId, key, value) values (?, ?, ?) on conflict(userId, key) do nothing"
    ).run(adminId, row.key, row.value);
  }
}

function assertAccount(name, email, password) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (cleanName.length < 1 || cleanName.length > 80) throw new Error("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("A valid email is required");
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    throw new Error("Password must be at least 8 characters");
  }
  return { name: cleanName, email: cleanEmail, password };
}

function setupAdmin(input) {
  if (!needsSetup()) throw new Error("Setup is closed");
  const account = assertAccount(input.name, input.email, input.password);
  const creds = auth.hashPassword(account.password);
  const id = crypto.randomUUID();
  const tx = db.transaction(() => {
    db.prepare(
      `insert into users (id, name, email, passwordHash, passwordSalt, role, active, createdAt)
       values (?, ?, ?, ?, ?, 'admin', 1, ?)`
    ).run(id, account.name, account.email, creds.passwordHash, creds.passwordSalt, Date.now());
    claimExistingData(id);
  });
  tx();
  return publicUser(db.prepare("select id, name, email, role, active, createdAt from users where id = ?").get(id));
}

function checkPassword(user, password) {
  if (!dummyPassword) dummyPassword = auth.hashPassword("placeholder");
  if (!user) {
    auth.verifyPassword(password, dummyPassword.passwordSalt, dummyPassword.passwordHash);
    return false;
  }
  return auth.verifyPassword(password, user.passwordSalt, user.passwordHash);
}

function loginUser(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const user = db.prepare("select * from users where email = ?").get(cleanEmail);
  const ok = checkPassword(user, password);
  if (!user || !user.active || !ok) return null;
  recordActivity(user.id, user.id, "account", "signed-in");
  return { user: publicUser(user), token: createSession(user.id) };
}

function createSession(userId) {
  const token = auth.sessionToken();
  db.prepare("insert into auth_sessions (tokenHash, userId, expiresAt) values (?, ?, ?)").run(
    auth.hashToken(token), userId, Date.now() + SESSION_MS
  );
  return token;
}

function userForToken(tokenHash) {
  const row = db.prepare(
    `select u.id, u.name, u.email, u.role, u.active, u.createdAt, u.avatar, s.expiresAt
     from auth_sessions s join users u on u.id = s.userId where s.tokenHash = ?`
  ).get(tokenHash);
  if (!row || row.expiresAt < Date.now() || !row.active) {
    if (row) db.prepare("delete from auth_sessions where tokenHash = ?").run(tokenHash);
    return null;
  }
  return publicUser(row);
}

function deleteSession(tokenHash) {
  db.prepare("delete from auth_sessions where tokenHash = ?").run(tokenHash);
}

function findUser(id) {
  const row = db.prepare("select id, name, email, role, active, createdAt, avatar from users where id = ?").get(id);
  return publicUser(row);
}

function setOwnAvatar(userId, avatar) {
  const user = db.prepare("select id from users where id = ?").get(userId);
  if (!user) throw new Error("Unknown user");
  if (avatar == null) {
    db.prepare("update users set avatar = null where id = ?").run(userId);
    return findUser(userId);
  }
  if (typeof avatar !== "string" || avatar.length > 120_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)) {
    throw new Error("Photo must be a small JPEG");
  }
  db.prepare("update users set avatar = ? where id = ?").run(avatar, userId);
  return findUser(userId);
}

function createMember(input) {
  const account = assertAccount(input.name, input.email, input.password);
  const creds = auth.hashPassword(account.password);
  const id = crypto.randomUUID();
  try {
    db.prepare(
      `insert into users (id, name, email, passwordHash, passwordSalt, role, active, createdAt)
       values (?, ?, ?, ?, ?, 'member', 1, ?)`
    ).run(id, account.name, account.email, creds.passwordHash, creds.passwordSalt, Date.now());
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) throw new Error("That email is already in use");
    throw error;
  }
  return findUser(id);
}

function setUserActive(actorId, userId, active) {
  const user = db.prepare("select id, role from users where id = ?").get(userId);
  if (!user) throw new Error("Unknown user");
  if (!active && userId === actorId) throw new Error("You cannot disable your own account");
  if (!active && user.role === "admin") {
    const others = db.prepare(
      "select count(*) as n from users where role = 'admin' and active = 1 and id != ?"
    ).get(userId).n;
    if (!others) throw new Error("At least one active admin is required");
  }
  db.prepare("update users set active = ? where id = ?").run(active ? 1 : 0, userId);
  if (!active) db.prepare("delete from auth_sessions where userId = ?").run(userId);
  recordActivity(userId, actorId, "account", active ? "enabled" : "disabled");
  return findUser(userId);
}

function setUserPassword(actorId, userId, password) {
  const account = assertAccount("temp", "user@example.com", password);
  const user = db.prepare("select id from users where id = ?").get(userId);
  if (!user) throw new Error("Unknown user");
  const creds = auth.hashPassword(account.password);
  db.prepare("update users set passwordHash = ?, passwordSalt = ? where id = ?").run(
    creds.passwordHash, creds.passwordSalt, userId
  );
  db.prepare("delete from auth_sessions where userId = ?").run(userId);
  recordActivity(userId, actorId, "account", "set-password");
}

function updateOwnAccount(userId, tokenHash, input) {
  const user = db.prepare("select * from users where id = ?").get(userId);
  if (!user || !user.active) throw new Error("Unknown user");
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (name.length < 1 || name.length > 80) throw new Error("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required");
  const nextPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  const emailChanged = email !== user.email;
  if (nextPassword || emailChanged) {
    if (!checkPassword(user, String(input.currentPassword || ""))) {
      throw new Error("Current password is wrong");
    }
  }
  if (nextPassword && (nextPassword.length < 8 || nextPassword.length > 200)) {
    throw new Error("Password must be at least 8 characters");
  }
  const creds = nextPassword ? auth.hashPassword(nextPassword) : null;
  try {
    if (creds) {
      db.prepare(
        "update users set name = ?, email = ?, passwordHash = ?, passwordSalt = ? where id = ?"
      ).run(name, email, creds.passwordHash, creds.passwordSalt, userId);
      db.prepare("delete from auth_sessions where userId = ? and tokenHash != ?").run(userId, tokenHash);
    } else {
      db.prepare("update users set name = ?, email = ? where id = ?").run(name, email, userId);
    }
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) throw new Error("That email is already in use");
    throw error;
  }
  recordActivity(userId, userId, "account", "updated");
  return findUser(userId);
}

function listUserJournals(userId) {
  if (!findUser(userId)) throw new Error("Unknown user");
  return db.prepare(
    `select id, userId, date, content, createdAt, mood, energy, adminNote, adminNoteAt, adminNoteBy
     from logs where userId = ? order by createdAt desc`
  ).all(userId);
}

function listMemberJournalCounts() {
  return db.prepare(
    `select u.id, u.name,
            (select count(*) from logs l where l.userId = u.id) as journalEntries
     from users u where u.role = 'member'
     order by u.name collate nocase`
  ).all();
}

function listMemberJournals(userId) {
  if (userId) {
    const user = findUser(userId);
    if (!user) throw new Error("Unknown user");
    if (user.role !== "member") return [];
  }
  const sql = `select l.id, l.userId, u.name as userName, l.date, l.content, l.createdAt, l.mood, l.energy,
                      l.adminNote, l.adminNoteAt, l.adminNoteBy
               from logs l join users u on u.id = l.userId
               where u.role = 'member'${userId ? " and l.userId = ?" : ""}
               order by l.createdAt desc`;
  return userId ? db.prepare(sql).all(userId) : db.prepare(sql).all();
}

function listJournalsByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) throw new Error("Invalid date");
  return db.prepare(
    `select l.id, l.userId, u.name as userName, l.date, l.content, l.createdAt, l.mood, l.energy,
            l.adminNote, l.adminNoteAt, l.adminNoteBy
     from logs l join users u on u.id = l.userId
     where l.date = ?
     order by l.createdAt desc`
  ).all(date);
}

function setLogAdminNote(actor, userId, logId, note) {
  if (!findUser(userId)) throw new Error("Unknown user");
  if (typeof note !== "string") throw new Error("Note must be text");
  const text = note.trim();
  if (text.length > 4000) throw new Error("Note is too long");
  const row = db.prepare("select id, date from logs where id = ? and userId = ?").get(logId, userId);
  if (!row) throw new Error("Not found");
  const adminNote = text || null;
  const adminNoteAt = text ? Date.now() : null;
  const adminNoteBy = text ? actor.name : null;
  db.prepare(
    "update logs set adminNote = ?, adminNoteAt = ?, adminNoteBy = ? where id = ? and userId = ?"
  ).run(adminNote, adminNoteAt, adminNoteBy, logId, userId);
  recordActivity(userId, actor.id, "logs", "noted");
  if (text && actor.id !== userId) {
    writeNotice(userId, actor, "journal_note", String(row.date || ""), "/journal", false);
    emitWorkspace({ type: "notification", userIds: [userId] });
  }
  emitWorkspace({ type: "changed", userIds: [userId] });
  return { id: logId, adminNote, adminNoteAt, adminNoteBy };
}

function countFor(sql, userId) {
  return db.prepare(sql).get(userId).n;
}

function latestChange(userId) {
  const queries = [
    "select max(updatedAt) as t from tasks where userId = ?",
    "select max(updatedAt) as t from notes where userId = ?",
    "select max(createdAt) as t from logs where userId = ?",
    "select max(startTime) as t from sessions where userId = ?",
  ];
  let latest = 0;
  for (const sql of queries) {
    const value = db.prepare(sql).get(userId).t;
    if (value > latest) latest = value;
  }
  return latest || null;
}

function dateKey(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function listDirectory() {
  return db.prepare("select id, name from users where active = 1 order by name collate nocase").all();
}

function listPeople() {
  const users = db.prepare(
    "select id, name, email, role, active, createdAt from users order by createdAt asc"
  ).all();
  const now = Date.now();
  const week = now - 7 * 24 * 60 * 60 * 1000;
  const weekKey = dateKey(week);
  return users.map((user) => {
    const seconds = db.prepare(
      "select coalesce(sum(duration), 0) as n from sessions where userId = ? and type = 'focus' and startTime >= ?"
    ).get(user.id, week).n;
    return {
      ...publicUser(user),
      openTasks: countFor(
        "select count(*) as n from tasks where userId = ? and status != 'done' and archived = 0",
        user.id
      ),
      overdueTasks: countFor(
        "select count(*) as n from tasks where userId = ? and status != 'done' and archived = 0 and deadline is not null and deadline < " + now,
        user.id
      ),
      tasksDone7d: countFor(
        "select count(*) as n from tasks where userId = ? and completedAt is not null and completedAt >= " + week,
        user.id
      ),
      journalEntries: countFor("select count(*) as n from logs where userId = ?", user.id),
      notes: countFor("select count(*) as n from notes where userId = ? and status != 'trashed'", user.id),
      learningSessions7d: countFor(
        "select count(*) as n from learningSessions where userId = ? and date >= '" + weekKey + "'",
        user.id
      ),
      focusMinutes: Math.round(seconds / 60),
      lastChange: latestChange(user.id),
    };
  });
}

function adminOverview() {
  const people = listPeople();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    days.push({
      date: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      start: start.getTime(),
      end: end.getTime(),
      tasksDone: 0,
    });
  }
  const doneRows = db.prepare(
    "select completedAt from tasks where completedAt is not null and completedAt >= ?"
  ).all(days[0].start);
  for (const row of doneRows) {
    const bucket = days.find((day) => row.completedAt >= day.start && row.completedAt < day.end);
    if (bucket) bucket.tasksDone += 1;
  }
  return {
    people: people.length,
    activeAccounts: people.filter((person) => person.active).length,
    openTasks: people.reduce((sum, person) => sum + person.openTasks, 0),
    overdueTasks: people.reduce((sum, person) => sum + person.overdueTasks, 0),
    focusMinutes: people.reduce((sum, person) => sum + person.focusMinutes, 0),
    focusByPerson: people.map((person) => ({ name: person.name, minutes: person.focusMinutes })),
    tasksPerDay: days.map(({ date, tasksDone }) => ({ date, tasksDone })),
    byPerson: people,
  };
}

function listActivity(limit = ACTIVITY_KEEP) {
  return db.prepare(
    `select a.userId, a.actorId, a.area, a.action, a.count, a.at,
            u.name as userName, actor.name as actorName
     from activity a
     left join users u on u.id = a.userId
     left join users actor on actor.id = a.actorId
     where a.area not in ('accounts', 'transactions', 'categories', 'budgets', 'savingsGoals')
     order by a.at desc
     limit ?`
  ).all(Math.min(ACTIVITY_KEEP, Math.max(1, limit)));
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

module.exports = {
  TABLES,
  getDataDir,
  getDbPath,
  initDatabase,
  openAt,
  withUser,
  getAll,
  getOne,
  putOne,
  delOne,
  clearAll,
  clearStore,
  exportAll,
  importAll,
  getConfig,
  setConfig,
  needsSetup,
  setupAdmin,
  loginUser,
  userForToken,
  deleteSession,
  findUser,
  createMember,
  setUserActive,
  setUserPassword,
  updateOwnAccount,
  setOwnAvatar,
  listPeople,
  listUserJournals,
  listMemberJournalCounts,
  listMemberJournals,
  listJournalsByDate,
  setLogAdminNote,
  onWorkspaceEvent,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listDirectory,
  adminOverview,
  listActivity,
  deleteActivityRange,
};
