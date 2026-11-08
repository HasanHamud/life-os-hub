const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Database = require("better-sqlite3");
const auth = require("../server/auth.cjs");

const root = path.join(__dirname, "..");
const sourcePath = path.join(process.env.APPDATA, "life-os-hub", "life-os.db");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-os-auth-"));
const dbPath = path.join(dir, "life-os.db");
const port = 9133;
const adminPassword = "admin-pass-123";
const memberPassword = "member-pass-123";

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

async function absent(cookie, store, id, label, user) {
  const list = await api(`/api/${store}`, { cookie, user });
  if (list.status !== 200 || !Array.isArray(list.data)) fail(`${label} list ${store} returned ${list.status}`);
  if (list.data.some((row) => row.id === id)) fail(`${label} can list ${store}/${id}`);
  const one = await api(`/api/${store}/${id}`, { cookie, user });
  if (one.status !== 404) fail(`${label} get ${store}/${id} returned ${one.status}`);
}

async function present(cookie, store, id, label, user) {
  const list = await api(`/api/${store}`, { cookie, user });
  if (list.status !== 200 || !Array.isArray(list.data) || !list.data.some((row) => row.id === id)) {
    fail(`${label} cannot list ${store}/${id}`);
  }
  const one = await api(`/api/${store}/${id}`, { cookie, user });
  if (one.status !== 200 || one.data.id !== id) fail(`${label} get ${store}/${id} returned ${one.status}`);
}

async function main() {
  if (!fs.existsSync(sourcePath)) fail(`Missing database ${sourcePath}`);
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  await source.backup(dbPath);
  source.close();

  const before = new Database(dbPath);
  const beforeTasks = before.prepare("select count(*) as n from tasks").get().n;
  const existing = before.prepare(
    "select id, email from users where role = 'admin' and active = 1 order by createdAt asc limit 1"
  ).get();
  let ownedTasks = beforeTasks;
  if (existing) {
    const creds = auth.hashPassword(adminPassword);
    before.prepare("update users set passwordHash = ?, passwordSalt = ? where id = ?").run(
      creds.passwordHash, creds.passwordSalt, existing.id
    );
    ownedTasks = before.prepare("select count(*) as n from tasks where userId = ?").get(existing.id).n;
  }
  before.close();

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

  const locked = await api("/api/tasks");
  if (locked.status !== 401) fail(`Expected 401 before sign-in, got ${locked.status}`);

  let admin;
  let adminId;
  let tasks;
  if (existing) {
    const login = await api("/api/auth/login", {
      method: "POST",
      body: { email: existing.email, password: adminPassword },
    });
    if (login.status !== 200 || login.data.user.role !== "admin") fail(`Admin login failed ${login.status} ${JSON.stringify(login.data)}`);
    admin = login.cookie;
    adminId = login.data.user.id;
    tasks = await api("/api/tasks", { cookie: admin });
    if (tasks.status !== 200 || tasks.data.length !== ownedTasks) {
      fail(`Admin should see only their ${ownedTasks} tasks, got ${tasks.status} ${tasks.data?.length}`);
    }
  } else {
    const setup = await api("/api/auth/setup", {
      method: "POST",
      body: { name: "Ada Admin", email: "ada@example.com", password: adminPassword },
    });
    if (setup.status !== 200 || setup.data.user.role !== "admin") fail(`Setup failed ${setup.status} ${JSON.stringify(setup.data)}`);
    admin = setup.cookie;
    adminId = setup.data.user.id;
    tasks = await api("/api/tasks", { cookie: admin });
    if (tasks.status !== 200 || tasks.data.length !== beforeTasks) {
      fail(`Admin should own the existing ${beforeTasks} tasks, got ${tasks.status} ${tasks.data?.length}`);
    }
  }
  if (tasks.data.some((task) => task.userId !== adminId)) fail("A listed task belongs to someone else");

  const exported = await api("/api/export", { cookie: admin });
  if (JSON.stringify(exported.data).includes("passwordHash") || JSON.stringify(exported.data).includes(adminPassword)) {
    fail("Export exposed a password or hash");
  }

  const settings = await api("/api/settings/global", { cookie: admin });
  if (settings.status !== 200 || settings.data.id !== adminId) fail("Settings were not copied onto the admin");

  const memberEmail = `mina-${Date.now()}@example.com`;
  const created = await api("/api/admin/people", {
    method: "POST",
    cookie: admin,
    body: { name: "Mina Member", email: memberEmail, password: memberPassword },
  });
  if (created.status !== 200) fail(`Create member failed ${created.status} ${JSON.stringify(created.data)}`);
  const memberId = created.data.id;

  const memberLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: memberEmail, password: memberPassword },
  });
  if (memberLogin.status !== 200) fail("Member login failed");
  const member = memberLogin.cookie;
  const memberTasks = await api("/api/tasks", { cookie: member });
  if (memberTasks.status !== 200 || memberTasks.data.length !== 0) fail("Member can see someone else's tasks");
  const memberAdmin = await api("/api/admin/people", { cookie: member });
  if (memberAdmin.status !== 403) fail(`Member admin page returned ${memberAdmin.status}`);
  const spoof = await api("/api/tasks", { cookie: member, user: adminId });
  if (spoof.status !== 403) fail(`Member spoof returned ${spoof.status}`);

  const moderated = await api("/api/tasks", {
    method: "PUT",
    cookie: admin,
    user: memberId,
    body: {
      id: "member-task-1",
      title: "Member only task",
      status: "todo",
      priority: "med",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  });
  if (moderated.status !== 200 || moderated.data.userId !== memberId) fail("Admin moderation did not stay in the member workspace");
  const adminAgain = await api("/api/tasks", { cookie: admin });
  if (adminAgain.data.some((task) => task.title === "Member only task")) fail("Member task leaked into the admin workspace");
  const memberAgain = await api("/api/tasks", { cookie: member });
  if (!memberAgain.data.some((task) => task.title === "Member only task")) fail("Member cannot see the moderated task");

  const now = Date.now();
  const owned = [
    ["projects", { id: "iso-project", name: "Mina private project", createdAt: now }],
    ["tasks", { id: "iso-task", title: "Mina private task", status: "todo", priority: "med", createdAt: now, updatedAt: now }],
    ["notes", { id: "iso-note", title: "Mina private note", content: "secret", type: "text", status: "active", createdAt: now, updatedAt: now }],
    ["accounts", { id: "iso-account", name: "Mina private account", type: "cash", currency: "USD", createdAt: now }],
  ];
  for (const [store, body] of owned) {
    const saved = await api(`/api/${store}`, { method: "PUT", cookie: member, body });
    if (saved.status !== 200 || saved.data.userId !== memberId) fail(`Member create ${store} failed ${saved.status} ${JSON.stringify(saved.data)}`);
  }

  const otherEmail = `omar-${Date.now()}@example.com`;
  const otherCreated = await api("/api/admin/people", {
    method: "POST",
    cookie: admin,
    body: { name: "Omar Other", email: otherEmail, password: memberPassword },
  });
  if (otherCreated.status !== 200) fail(`Create second member failed ${otherCreated.status}`);
  const otherLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: otherEmail, password: memberPassword },
  });
  if (otherLogin.status !== 200) fail("Second member login failed");
  const other = otherLogin.cookie;

  for (const [store, body] of owned) {
    await present(member, store, body.id, "Owner");
    await absent(other, store, body.id, "Other member");
    await absent(admin, store, body.id, "Admin own workspace");
    if (store === "accounts") await absent(admin, store, body.id, "Admin viewing member", memberId);
    else await present(admin, store, body.id, "Admin viewing member", memberId);
  }
  const spoofMember = await api("/api/projects", { cookie: other, user: memberId });
  if (spoofMember.status !== 403) fail(`Second member spoofed the first, got ${spoofMember.status}`);
  const spoofAdmin = await api("/api/tasks", { cookie: other, user: adminId });
  if (spoofAdmin.status !== 403) fail(`Second member spoofed the admin, got ${spoofAdmin.status}`);
  const stolen = await api("/api/projects", {
    method: "PUT",
    cookie: other,
    body: { id: "iso-project", name: "Stolen project", createdAt: now },
  });
  if (stolen.status === 200) fail("Other member overwrote a private project");
  const still = await api("/api/projects/iso-project", { cookie: member });
  if (still.status !== 200 || still.data.name !== "Mina private project") fail("Private project was changed");
  const otherExport = await api("/api/export", { cookie: other });
  const otherDump = JSON.stringify(otherExport.data);
  if (otherDump.includes("iso-project") || otherDump.includes("Mina private")) fail("Other member export leaked private rows");
  if (tasks.data[0]) {
    await absent(member, "tasks", tasks.data[0].id, "Member vs admin task");
    await absent(other, "tasks", tasks.data[0].id, "Other member vs admin task");
  }

  const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
  const savedPhoto = await api("/api/auth/avatar", { method: "POST", cookie: member, body: { avatar: photo } });
  if (savedPhoto.status !== 200 || savedPhoto.data.user.avatar !== photo) fail("Avatar was not saved");
  const mePhoto = await api("/api/auth/me", { cookie: member });
  if (mePhoto.data.user?.avatar !== photo) fail("Avatar missing from session");
  const clearedPhoto = await api("/api/auth/avatar", { method: "POST", cookie: member, body: { avatar: null } });
  if (clearedPhoto.status !== 200 || clearedPhoto.data.user.avatar) fail("Avatar was not cleared");
  const badPhoto = await api("/api/auth/avatar", {
    method: "POST",
    cookie: member,
    body: { avatar: "data:text/plain;base64,QQ==" },
  });
  if (badPhoto.status < 400) fail(`Non-image avatar was accepted (${badPhoto.status})`);

  const disableAdmin = await api(`/api/admin/people/${adminId}/active`, {
    method: "POST",
    cookie: admin,
    body: { active: false },
  });
  if (disableAdmin.status === 200) fail("Admin was able to disable their own account");

  const disableMember = await api(`/api/admin/people/${memberId}/active`, {
    method: "POST",
    cookie: admin,
    body: { active: false },
  });
  if (disableMember.status !== 200 || disableMember.data.active !== false) fail("Could not disable the member");
  const disabledCall = await api("/api/tasks", { cookie: member });
  if (disabledCall.status !== 401) fail("Disabled member session still works");
  const disabledLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: memberEmail, password: memberPassword },
  });
  if (disabledLogin.status !== 401) fail("Disabled member can still sign in");

  const stored = new Database(dbPath, { readonly: true });
  const secret = stored.prepare("select passwordHash, passwordSalt from users where id = ?").get(adminId);
  stored.close();
  if (!secret || secret.passwordHash === adminPassword || secret.passwordSalt.length < 16) fail("Password was not stored as a salted hash");

  console.log("OK", { tasks: beforeTasks, adminId, memberId });
  stop();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  process.exit(1);
});
