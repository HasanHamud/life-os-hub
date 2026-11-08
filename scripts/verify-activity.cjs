const fs = require("fs");
const os = require("os");
const path = require("path");
const database = require("../server/database.cjs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-os-activity-"));
database.openAt(path.join(dir, "life-os.db"));

function fail(message) {
  console.error("FAIL:", message);
  process.exit(1);
}

const admin = database.setupAdmin({
  name: "Ada",
  email: "ada@example.com",
  password: "admin-pass-123",
});

const now = Date.now();
database.withUser(admin.id, () => {
  database.putOne("tasks", {
    id: "t1",
    title: "Secret title one",
    status: "todo",
    priority: "med",
    tagIds: [],
    createdAt: now,
    updatedAt: now,
  });
  database.putOne("tasks", {
    id: "t2",
    title: "Secret title two",
    status: "todo",
    priority: "med",
    tagIds: [],
    createdAt: now,
    updatedAt: now,
  });
});

const rows = database.listActivity().filter((row) => row.area === "tasks" && row.action === "created");
if (rows.length !== 1) fail(`expected 1 created row, got ${rows.length}`);
if (rows[0].count !== 2) fail(`expected count 2, got ${rows[0].count}`);
if (JSON.stringify(rows[0]).includes("Secret")) fail("activity row stored a task title");

const Database = require("better-sqlite3");
const raw = new Database(path.join(dir, "life-os.db"));
const weekAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
raw.prepare(
  "insert into activity (id, userId, actorId, area, action, count, at) values (?, ?, ?, ?, ?, 1, ?)"
).run("old-row", admin.id, admin.id, "snapshots", "cleared", weekAgo);
raw.close();
database.withUser(admin.id, () => {
  database.putOne("tasks", {
    id: "t1",
    title: "Secret title one",
    status: "todo",
    priority: "med",
    tagIds: [],
    createdAt: now,
    updatedAt: now,
  });
});
if (database.listActivity().some((row) => row.area === "snapshots")) fail("kept a row older than 7 days");

const noon = new Date();
noon.setHours(12, 0, 0, 0);
const earlier = new Date(noon);
earlier.setDate(earlier.getDate() - 2);
earlier.setHours(12, 0, 0, 0);
function ymd(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
const rawAgain = new Database(path.join(dir, "life-os.db"));
const insert = rawAgain.prepare(
  "insert into activity (id, userId, actorId, area, action, count, at) values (?, ?, ?, ?, ?, 1, ?)"
);
insert.run("in-range", admin.id, admin.id, "notes", "deleted", noon.getTime());
insert.run("out-range", admin.id, admin.id, "goals", "deleted", earlier.getTime());
rawAgain.close();
let reversed = false;
try {
  database.deleteActivityRange(ymd(noon), ymd(earlier));
} catch {
  reversed = true;
}
if (!reversed) fail("accepted a reversed date range");
const deleted = database.deleteActivityRange(ymd(noon), ymd(noon));
if (deleted.deleted < 1) fail(`expected the chosen day to delete a row, got ${deleted.deleted}`);
const left = database.listActivity();
if (left.some((row) => row.area === "notes" && row.action === "deleted")) fail("kept a row inside the chosen day");
if (!left.some((row) => row.area === "goals" && row.action === "deleted")) fail("deleted a row outside the chosen day");

console.log("ok");
