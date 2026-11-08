const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-os-share-"));
const dbPath = path.join(dir, "life-os.db");
const port = 9136;
const password = "share-pass-123";

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function cookieFrom(res) {
  const raw = res.headers.get("set-cookie") || "";
  const match = raw.match(/life_os_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function api(pathname, { method = "GET", body, cookie, user } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = `life_os_session=${encodeURIComponent(cookie)}`;
  if (user) headers["X-Life-Os-User"] = user;
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: res.status, data, cookie: cookieFrom(res) };
}

function has(list, id) {
  return list.status === 200 && Array.isArray(list.data) && list.data.some((row) => row.id === id);
}

async function main() {
  const env = { ...process.env, LIFE_OS_DB: dbPath, PORT: String(port) };
  const child = spawn(process.execPath, ["server/index.cjs"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  const stop = () => { try { child.kill(); } catch { /* already stopped */ } };
  process.on("exit", stop);

  const started = Date.now();
  while (!logs.includes("Listening") && Date.now() - started < 15000) {
    if (child.exitCode != null) fail(logs || "Server exited");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!logs.includes("Listening")) fail(logs || "Server did not start");

  const setup = await api("/api/auth/setup", {
    method: "POST",
    body: { name: "Ada Manager", email: "ada-share@example.com", password },
  });
  if (setup.status !== 200) fail(`Setup failed ${setup.status}`);
  const admin = setup.cookie;

  async function member(name, email) {
    const created = await api("/api/admin/people", {
      method: "POST",
      cookie: admin,
      body: { name, email, password },
    });
    if (created.status !== 200) fail(`Create ${name} failed ${created.status} ${JSON.stringify(created.data)}`);
    const login = await api("/api/auth/login", { method: "POST", body: { email, password } });
    if (login.status !== 200) fail(`${name} login failed`);
    return { id: created.data.id, cookie: login.cookie };
  }

  const a = await member("Amina", "amina-share@example.com");
  const b = await member("Bilal", "bilal-share@example.com");
  const c = await member("Camille", "camille-share@example.com");
  const now = Date.now();

  const project = await api("/api/projects", {
    method: "PUT",
    cookie: admin,
    body: { id: "shared-project", name: "Shared", memberIds: [a.id, b.id], createdAt: now },
  });
  if (project.status !== 200 || project.data.userId !== setup.data.user.id) fail("Project was not stored on the manager");
  if (!project.data.memberIds.includes(a.id) || !project.data.memberIds.includes(b.id)) fail("Project members were not saved");

  const task = await api("/api/tasks", {
    method: "PUT",
    cookie: admin,
    body: {
      id: "shared-task", title: "Shared task", status: "todo", priority: "med",
      projectId: "shared-project", createdAt: now, updatedAt: now,
    },
  });
  if (task.status !== 200 || task.data.userId !== setup.data.user.id) fail("Project task was not stored on the manager");

  for (const person of [a, b]) {
    const tasks = await api("/api/tasks", { cookie: person.cookie });
    const projects = await api("/api/projects", { cookie: person.cookie });
    if (!has(tasks, "shared-task") || !has(projects, "shared-project")) fail("Assigned member cannot see the project task");
  }
  const hiddenTasks = await api("/api/tasks", { cookie: c.cookie });
  const hiddenProjects = await api("/api/projects", { cookie: c.cookie });
  if (has(hiddenTasks, "shared-task") || has(hiddenProjects, "shared-project")) fail("Unassigned member can see the project");

  const personal = await api("/api/tasks", {
    method: "PUT",
    cookie: a.cookie,
    body: {
      id: "personal-task", title: "Amina personal", status: "todo", priority: "low",
      projectId: null, createdAt: now, updatedAt: now,
    },
  });
  if (personal.status !== 200 || personal.data.userId !== a.id) fail("Personal task was not stored on the member");
  const managerTasks = await api("/api/tasks", { cookie: admin });
  if (!has(managerTasks, "personal-task") || !has(managerTasks, "shared-task")) fail("Manager cannot see a member task");
  const otherTasks = await api("/api/tasks", { cookie: b.cookie });
  if (has(otherTasks, "personal-task")) fail("Another member can see a personal task");

  const moved = await api("/api/tasks", {
    method: "PUT",
    cookie: a.cookie,
    body: { ...personal.data, status: "done" },
  });
  if (moved.status !== 200 || moved.data.status !== "done" || moved.data.userId !== a.id) fail("Member could not update their own task");

  const sharedUpdate = await api("/api/tasks", {
    method: "PUT",
    cookie: b.cookie,
    body: { ...task.data, status: "in_progress" },
  });
  if (sharedUpdate.status !== 200 || sharedUpdate.data.userId !== setup.data.user.id) fail("Assigned member could not update the project task");

  const blocked = await api("/api/tasks", {
    method: "PUT",
    cookie: c.cookie,
    body: { ...task.data, title: "Stolen" },
  });
  if (blocked.status === 200) fail("Unassigned member updated the project task");

  const adminExport = JSON.stringify((await api("/api/export", { cookie: admin })).data);
  if (adminExport.includes("personal-task") || adminExport.includes("Amina personal")) fail("Manager export copied a member task");
  const memberExport = JSON.stringify((await api("/api/export", { cookie: a.cookie })).data);
  if (memberExport.includes("shared-task") || memberExport.includes("shared-project")) fail("Member export copied the shared project");

  stop();
  console.log("shared project visibility ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
