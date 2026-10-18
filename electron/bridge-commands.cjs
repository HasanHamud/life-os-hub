const crypto = require("crypto");
const database = require("./database.cjs");

const PRIORITIES = ["low", "med", "high", "urgent"];
const TASK_STATUSES = ["backlog", "todo", "in_progress", "blocked", "done"];
const BLOCK_TYPES = ["work", "freelance", "personal", "studies", "university"];
const NOTE_TYPES = ["text", "checklist", "code", "idea", "meeting", "doc", "sql", "api"];
const TX_TYPES = ["income", "expense", "transfer"];

function uid() {
  return crypto.randomUUID();
}

function ok(data, changed = false) {
  return { ok: true, changed, ...data };
}

function fail(error, matches) {
  const out = { ok: false, changed: false, error };
  if (matches) out.matches = matches;
  return out;
}

function matchNamed(items, query, label) {
  const names = items.map((item) => item.name);
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { error: `${label} name is required`, matches: names };
  const exact = items.filter((item) => item.name.toLowerCase() === q);
  if (exact.length === 1) return { item: exact[0] };
  if (exact.length > 1) {
    return { error: `Several ${label}s match "${query}"`, matches: exact.map((item) => item.name) };
  }
  const partial = items.filter((item) => item.name.toLowerCase().includes(q));
  if (partial.length === 1) return { item: partial[0] };
  if (partial.length === 0) return { error: `No ${label} named "${query}"`, matches: names };
  return { error: `Several ${label}s match "${query}"`, matches: partial.map((item) => item.name) };
}

function matchTitled(items, query, label) {
  return matchNamed(items.map((item) => ({ ...item, name: item.title })), query, label);
}

function activeProjects() {
  return database.getAll("projects").filter((project) => !project.archived);
}

function activeAccounts() {
  return database.getAll("accounts").filter((account) => !account.archived);
}

function normPriority(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  const mapped = raw === "medium" || raw === "normal" ? "med" : raw;
  if (!PRIORITIES.includes(mapped)) return undefined;
  return mapped;
}

function oneOf(value, allowed) {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  return allowed.includes(raw) ? raw : undefined;
}

function clampScale(value, max) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) return undefined;
  return n;
}

function parseWhen(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.getTime();
}

function todayStr(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(value) {
  if (value == null || value === "" || value === "today") return todayStr();
  const text = String(value).trim().toLowerCase();
  if (text === "tomorrow") {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return todayStr(next);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  return text;
}

function dayBounds(day) {
  const [year, month, date] = day.split("-").map(Number);
  return {
    start: new Date(year, month - 1, date, 0, 0, 0, 0).getTime(),
    end: new Date(year, month - 1, date, 23, 59, 59, 999).getTime(),
  };
}

function projectName(id) {
  if (!id) return null;
  const project = database.getOne("projects", id);
  return project ? project.name : null;
}

function clip(text, max = 180) {
  if (!text) return "";
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function recent(rows, key, limit = 15) {
  return [...rows].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, limit);
}

function listProjects() {
  const projects = activeProjects().map((project) => ({
    id: project.id,
    name: project.name,
    category: project.category || null,
    description: project.description || null,
  }));
  return ok({ projects });
}

function addProject(body) {
  const name = String(body.name || "").trim();
  if (!name) return fail("Project name is required");
  const existing = activeProjects().find((project) => project.name.toLowerCase() === name.toLowerCase());
  if (existing) return fail(`Project "${existing.name}" already exists`, [existing.name]);
  const project = {
    id: uid(),
    name,
    description: body.description ? String(body.description) : null,
    color: "#d4a574",
    category: body.category ? String(body.category).trim() : null,
    archived: false,
    createdAt: Date.now(),
  };
  database.putOne("projects", project);
  return ok({ project: { id: project.id, name: project.name, category: project.category } }, true);
}

function listTasks(body) {
  let tasks = database.getAll("tasks").filter((task) => !task.archived && task.status !== "done");
  if (body.project) {
    const matched = matchNamed(activeProjects(), body.project, "project");
    if (!matched.item) return fail(matched.error, matched.matches);
    tasks = tasks.filter((task) => task.projectId === matched.item.id);
  }
  const items = recent(tasks, "updatedAt", 40).map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    project: projectName(task.projectId),
    deadline: task.deadline || null,
  }));
  return ok({ tasks: items });
}

function addTask(body) {
  const title = String(body.title || "").trim();
  if (!title) return fail("Task title is required");
  const priority = normPriority(body.priority);
  if (priority === undefined) return fail("Priority must be low, med, high, or urgent");
  const status = oneOf(body.status, TASK_STATUSES);
  if (status === undefined) return fail("Status must be backlog, todo, in_progress, blocked, or done");
  let projectId = null;
  let project = null;
  if (body.project) {
    const matched = matchNamed(activeProjects(), body.project, "project");
    if (!matched.item) return fail(matched.error, matched.matches);
    projectId = matched.item.id;
    project = matched.item.name;
  }
  const deadline = parseWhen(body.deadline);
  if (deadline === undefined) return fail("Deadline must be an ISO date or timestamp");
  const now = Date.now();
  const task = {
    id: uid(),
    title,
    description: body.description ? String(body.description) : null,
    status: status || "todo",
    priority: priority || "med",
    effort: body.effort == null || body.effort === "" ? null : Number(body.effort),
    deadline,
    projectId,
    goalId: null,
    tagIds: [],
    parentTaskId: null,
    dependsOnIds: [],
    recurrence: null,
    recurrenceParentId: null,
    archived: false,
    completedAt: (status || "todo") === "done" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  if (task.effort != null && !Number.isFinite(task.effort)) return fail("Effort must be a number of minutes");
  database.putOne("tasks", task);
  return ok({
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      project,
      deadline: task.deadline,
    },
  }, true);
}

function updateTask(body) {
  let task;
  if (body.id) {
    task = database.getOne("tasks", String(body.id));
    if (!task) return fail(`No task with id ${body.id}`);
  } else if (body.title) {
    const open = database.getAll("tasks").filter((item) => !item.archived);
    const matched = matchTitled(open, body.title, "task");
    if (!matched.item) return fail(matched.error, matched.matches);
    task = database.getOne("tasks", matched.item.id);
  } else {
    return fail("Task id or title is required");
  }

  const next = { ...task, updatedAt: Date.now() };
  if (body.newTitle != null && String(body.newTitle).trim()) next.title = String(body.newTitle).trim();
  if (body.priority != null && body.priority !== "") {
    const priority = normPriority(body.priority);
    if (!priority) return fail("Priority must be low, med, high, or urgent");
    next.priority = priority;
  }
  if (body.status != null && body.status !== "") {
    const status = oneOf(body.status, TASK_STATUSES);
    if (!status) return fail("Status must be backlog, todo, in_progress, blocked, or done");
    next.status = status;
    next.completedAt = status === "done" ? (task.completedAt || Date.now()) : null;
  }
  if (body.project) {
    const matched = matchNamed(activeProjects(), body.project, "project");
    if (!matched.item) return fail(matched.error, matched.matches);
    next.projectId = matched.item.id;
  }
  database.putOne("tasks", next);
  return ok({
    task: {
      id: next.id,
      title: next.title,
      status: next.status,
      priority: next.priority,
      project: projectName(next.projectId),
    },
  }, true);
}

function listGoals() {
  const goals = recent(database.getAll("goals"), "createdAt", 30).map((goal) => ({
    id: goal.id,
    title: goal.title,
    durationDays: goal.durationDays,
    endDate: goal.endDate,
  }));
  return ok({ goals });
}

function addGoal(body) {
  const title = String(body.title || "").trim();
  if (!title) return fail("Goal title is required");
  const durationDays = Number(body.durationDays || 30);
  if (![30, 60, 90].includes(durationDays) && (!Number.isFinite(durationDays) || durationDays <= 0)) {
    return fail("durationDays must be a positive number, usually 30, 60, or 90");
  }
  const startDate = Date.now();
  const goal = {
    id: uid(),
    title,
    description: body.description ? String(body.description) : null,
    durationDays,
    startDate,
    endDate: startDate + durationDays * 86400000,
    linkedTaskIds: [],
    createdAt: startDate,
  };
  database.putOne("goals", goal);
  return ok({ goal: { id: goal.id, title: goal.title, durationDays, endDate: goal.endDate } }, true);
}

function listNotes() {
  const notes = recent(
    database.getAll("notes").filter((note) => note.status !== "trashed"),
    "updatedAt",
    15,
  ).map((note) => ({
    id: note.id,
    title: note.title,
    type: note.type,
    updatedAt: note.updatedAt,
    preview: clip(note.content),
  }));
  return ok({ notes });
}

function addNote(body) {
  const title = String(body.title || "").trim();
  if (!title) return fail("Note title is required");
  const type = oneOf(body.type, NOTE_TYPES);
  if (type === undefined) return fail("Note type must be text, checklist, code, idea, meeting, doc, sql, or api");
  let projectId = null;
  if (body.project) {
    const matched = matchNamed(activeProjects(), body.project, "project");
    if (!matched.item) return fail(matched.error, matched.matches);
    projectId = matched.item.id;
  }
  const now = Date.now();
  const note = {
    id: uid(),
    title,
    content: body.content ? String(body.content) : "",
    type: type || "text",
    status: "active",
    category: null,
    tagIds: [],
    priority: null,
    favorite: false,
    pinned: false,
    color: null,
    icon: null,
    projectId,
    language: body.language ? String(body.language) : null,
    attachments: [],
    isTemplate: false,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
  };
  database.putOne("notes", note);
  return ok({ note: { id: note.id, title: note.title, type: note.type, project: projectName(projectId) } }, true);
}

function listJournal() {
  const entries = recent(database.getAll("logs"), "createdAt", 15).map((entry) => ({
    id: entry.id,
    date: entry.date,
    content: clip(entry.content),
    mood: entry.mood || null,
    energy: entry.energy || null,
  }));
  return ok({ entries });
}

function addJournal(body) {
  const content = String(body.content || "").trim();
  if (!content) return fail("Journal content is required");
  const date = parseDay(body.date);
  if (!date) return fail("Date must be YYYY-MM-DD, today, or tomorrow");
  const mood = clampScale(body.mood, 5);
  const energy = clampScale(body.energy, 5);
  if (mood === undefined || energy === undefined) return fail("Mood and energy must be integers from 1 to 5");
  const entry = {
    id: uid(),
    date,
    content,
    relatedTaskId: null,
    mood,
    energy,
    createdAt: Date.now(),
  };
  database.putOne("logs", entry);
  return ok({ entry: { id: entry.id, date, content: clip(content), mood, energy } }, true);
}

function listTimeBlocks(body) {
  const day = parseDay(body.date);
  if (!day) return fail("Date must be YYYY-MM-DD, today, or tomorrow");
  const { start, end } = dayBounds(day);
  const blocks = database.getAll("timeBlocks")
    .filter((block) => block.startTime >= start && block.startTime <= end)
    .sort((a, b) => a.startTime - b.startTime)
    .map((block) => ({
      id: block.id,
      title: block.title,
      type: block.type,
      startTime: block.startTime,
      endTime: block.endTime,
    }));
  return ok({ date: day, blocks });
}

function addTimeBlock(body) {
  const title = String(body.title || "").trim();
  if (!title) return fail("Time block title is required");
  const type = oneOf(body.type, BLOCK_TYPES);
  if (!type) return fail("Type must be work, freelance, personal, studies, or university");
  const startTime = parseWhen(body.start);
  const endTime = parseWhen(body.end);
  if (!startTime || !endTime) return fail("Start and end must be ISO datetimes");
  if (endTime <= startTime) return fail("End must be after start");
  const block = {
    id: uid(),
    taskId: null,
    title,
    startTime,
    endTime,
    type,
    isCompleted: false,
    notes: body.notes ? String(body.notes) : null,
    recurrence: null,
    recurrenceParentId: null,
    createdAt: Date.now(),
  };
  database.putOne("timeBlocks", block);
  return ok({ block: { id: block.id, title, type, startTime, endTime } }, true);
}

function addFocus(body) {
  const minutes = Number(body.minutes);
  if (!Number.isFinite(minutes) || minutes === 0) return fail("minutes is required");
  const day = parseDay(body.date);
  if (!day) return fail("Date must be YYYY-MM-DD, today, or tomorrow");
  const [year, month, date] = day.split("-").map(Number);
  const noon = new Date(year, month - 1, date, 12, 0, 0, 0).getTime();
  const session = {
    id: uid(),
    taskId: null,
    projectId: null,
    startTime: noon,
    endTime: noon + Math.round(minutes * 60_000),
    duration: Math.round(minutes * 60),
    type: "focus",
    notes: body.note ? String(body.note) : "__adjustment",
  };
  database.putOne("sessions", session);
  return ok({ focus: { date: day, minutes, id: session.id } }, true);
}

function listConcepts() {
  const concepts = recent(database.getAll("concepts"), "updatedAt", 30).map((concept) => ({
    id: concept.id,
    title: concept.title,
    subject: concept.subject,
    topic: concept.topic,
    clarityRating: concept.clarityRating,
  }));
  return ok({ concepts });
}

function addConcept(body) {
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  if (!title || !subject) return fail("Concept title and subject are required");
  const clarity = clampScale(body.clarity == null ? 1 : body.clarity, 5);
  if (clarity == null) return fail("Clarity must be an integer from 1 to 5");
  const now = Date.now();
  const concept = {
    id: uid(),
    subject,
    topic: body.topic ? String(body.topic) : "",
    title,
    phase: Number(body.phase || 1) || 1,
    clarityRating: clarity,
    canExplainWithoutNotes: Boolean(body.canExplainWithoutNotes),
    notes: body.notes ? String(body.notes) : "",
    resourceLinks: [],
    tags: [],
    problemIds: [],
    createdAt: now,
    updatedAt: now,
  };
  database.putOne("concepts", concept);
  return ok({
    concept: { id: concept.id, title, subject, topic: concept.topic, clarityRating: clarity },
  }, true);
}

function listInsights() {
  const insights = recent(database.getAll("insights"), "createdAt", 30).map((insight) => ({
    id: insight.id,
    subject: insight.subject,
    topic: insight.topic,
    keyIdea: insight.keyIdea,
    date: insight.date,
  }));
  return ok({ insights });
}

function addInsight(body) {
  const subject = String(body.subject || "").trim();
  const keyIdea = String(body.keyIdea || "").trim();
  if (!subject || !keyIdea) return fail("Insight subject and keyIdea are required");
  const date = parseDay(body.date);
  if (!date) return fail("Date must be YYYY-MM-DD, today, or tomorrow");
  const insights = Array.isArray(body.insights)
    ? body.insights.map(String)
    : body.insights
      ? [String(body.insights)]
      : [];
  const insight = {
    id: uid(),
    subject,
    topic: body.topic ? String(body.topic) : "",
    keyIdea,
    insights,
    mistakes: body.mistakes ? String(body.mistakes) : "",
    conceptId: null,
    problemId: null,
    tags: [],
    date,
    nextReviewAt: null,
    reviewCount: 0,
    createdAt: Date.now(),
  };
  database.putOne("insights", insight);
  return ok({ insight: { id: insight.id, subject, topic: insight.topic, keyIdea, date } }, true);
}

function listProblems() {
  const problems = recent(database.getAll("problems"), "createdAt", 30).map((problem) => ({
    id: problem.id,
    title: problem.title,
    subject: problem.subject,
    difficulty: problem.difficulty,
    completed: Boolean(problem.completed),
  }));
  return ok({ problems });
}

function addProblem(body) {
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  if (!title || !subject) return fail("Problem title and subject are required");
  const difficulty = clampScale(body.difficulty == null ? 1 : body.difficulty, 5);
  if (difficulty == null) return fail("Difficulty must be an integer from 1 to 5");
  const problem = {
    id: uid(),
    title,
    subject,
    source: body.source ? String(body.source) : "",
    difficulty,
    patternClass: body.patternClass ? String(body.patternClass) : "",
    timeToSolve: null,
    notes: body.notes ? String(body.notes) : "",
    tags: [],
    completed: false,
    completedAt: null,
    createdAt: Date.now(),
  };
  database.putOne("problems", problem);
  return ok({ problem: { id: problem.id, title, subject, difficulty } }, true);
}

function listAccounts() {
  const accounts = activeAccounts().map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
  }));
  return ok({ accounts });
}

function listCategories() {
  const categories = database.getAll("categories").map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
  }));
  return ok({ categories });
}

function listTransactions() {
  const accounts = database.getAll("accounts");
  const categories = database.getAll("categories");
  const accountName = (id) => accounts.find((account) => account.id === id)?.name || null;
  const categoryName = (id) => categories.find((category) => category.id === id)?.name || null;
  const transactions = recent(database.getAll("transactions"), "date", 15).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    account: accountName(tx.accountId),
    toAccount: accountName(tx.toAccountId),
    category: categoryName(tx.categoryId),
    note: tx.note || null,
    date: tx.date,
  }));
  return ok({ transactions });
}

function addTransaction(body) {
  const type = oneOf(body.type, TX_TYPES);
  if (!type) return fail("Type must be expense, income, or transfer");
  const amount = Math.abs(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return fail("Amount must be a positive number");
  const accountMatch = matchNamed(activeAccounts(), body.account, "account");
  if (!accountMatch.item) return fail(accountMatch.error, accountMatch.matches);
  let toAccount = null;
  if (type === "transfer") {
    const dest = matchNamed(activeAccounts(), body.toAccount, "account");
    if (!dest.item) return fail(dest.error, dest.matches);
    if (dest.item.id === accountMatch.item.id) return fail("Transfer accounts must be different");
    toAccount = dest.item;
  }
  let category = null;
  if (body.category) {
    let pool = database.getAll("categories");
    if (type === "expense" || type === "income") pool = pool.filter((item) => item.type === type);
    const matched = matchNamed(pool, body.category, "category");
    if (!matched.item) return fail(matched.error, matched.matches);
    category = matched.item;
  }
  const when = parseWhen(body.date);
  if (when === undefined) return fail("Date must be an ISO date or timestamp");
  const tx = {
    id: uid(),
    type,
    amount,
    categoryId: category ? category.id : null,
    accountId: accountMatch.item.id,
    toAccountId: toAccount ? toAccount.id : null,
    date: when || Date.now(),
    note: body.note ? String(body.note) : null,
    relatedTaskId: null,
    relatedGoalId: null,
    recurrence: null,
    recurrenceParentId: null,
    createdAt: Date.now(),
  };
  database.putOne("transactions", tx);
  return ok({
    transaction: {
      id: tx.id,
      type,
      amount,
      account: accountMatch.item.name,
      toAccount: toAccount ? toAccount.name : null,
      category: category ? category.name : null,
      currency: accountMatch.item.currency,
      note: tx.note,
    },
  }, true);
}

const HANDLERS = {
  list_projects: listProjects,
  add_project: addProject,
  list_tasks: listTasks,
  add_task: addTask,
  update_task: updateTask,
  list_goals: listGoals,
  add_goal: addGoal,
  list_notes: listNotes,
  add_note: addNote,
  list_journal: listJournal,
  add_journal: addJournal,
  list_time_blocks: listTimeBlocks,
  add_time_block: addTimeBlock,
  add_focus: addFocus,
  list_concepts: listConcepts,
  add_concept: addConcept,
  list_insights: listInsights,
  add_insight: addInsight,
  list_problems: listProblems,
  add_problem: addProblem,
  list_accounts: listAccounts,
  list_categories: listCategories,
  list_transactions: listTransactions,
  add_transaction: addTransaction,
};

function handle(action, body = {}) {
  const handler = HANDLERS[action];
  if (!handler) return fail(`Unknown action: ${action}`);
  return handler(body || {});
}

module.exports = { handle };
