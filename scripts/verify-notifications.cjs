const fs = require("fs");
const os = require("os");
const path = require("path");
const database = require("../server/database.cjs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-os-notifications-"));
database.openAt(path.join(dir, "life-os.db"));

function fail(message) {
  console.error("FAIL:", message);
  process.exit(1);
}

function rows(userId, kind) {
  return database.listNotifications(userId).items.filter((row) => row.kind === kind);
}

const admin = database.setupAdmin({
  name: "Ada",
  email: "ada@example.com",
  password: "admin-pass-123",
});
const member = database.createMember({
  name: "Bea",
  email: "bea@example.com",
  password: "member-pass-123",
});
const other = database.createMember({
  name: "Cam",
  email: "cam@example.com",
  password: "member-pass-123",
});

const now = Date.now();
database.withUser(member.id, () => {
  database.putOne("logs", {
    id: "log-1",
    date: "2026-10-27",
    content: "Did the work",
    createdAt: now,
  });
});

if (rows(admin.id, "journal_added").length !== 1) fail("journal create did not notify the admin");
if (database.listNotifications(other.id).unread !== 0) fail("another member received the journal");
if (database.listNotifications(member.id).unread !== 0) fail("member was notified of their own journal");

database.withUser(member.id, () => {
  database.putOne("logs", {
    id: "log-1",
    date: "2026-10-27",
    content: "Did the work, updated",
    createdAt: now,
  });
});
if (rows(admin.id, "journal_added").length !== 1) fail("journal edit created another notification");

database.withUser(member.id, () => {
  database.putOne("tasks", {
    id: "task-1",
    title: "Ship",
    status: "todo",
    createdAt: now,
    updatedAt: now,
  });
});
if (rows(admin.id, "task_created").length !== 1) fail("task create did not notify the admin");
if (rows(admin.id, "task_created")[0].href !== "/tasks/task-1") fail("task create link was wrong");

database.withUser(member.id, () => {
  database.putOne("tasks", {
    id: "task-1",
    title: "Ship it",
    status: "todo",
    createdAt: now,
    updatedAt: now + 1,
  });
});
if (rows(admin.id, "task_moved").length !== 0) fail("title edit notified as a move");

database.withUser(member.id, () => {
  database.putOne("tasks", {
    id: "task-1",
    title: "Ship it",
    status: "in_progress",
    createdAt: now,
    updatedAt: now + 2,
  });
  database.putOne("tasks", {
    id: "task-1",
    title: "Ship it",
    status: "done",
    createdAt: now,
    updatedAt: now + 3,
  });
});
const moved = rows(admin.id, "task_moved");
if (moved.length !== 1 || moved[0].count !== 2) fail(`expected one move row with count 2, got ${moved.length} / ${moved[0]?.count}`);
if (moved[0].href !== "/tasks") fail("move link was not the board");
if (database.listNotifications(other.id).unread !== 0) fail("another member received a task notification");

const adminInbox = database.listNotifications(admin.id).items.length;
database.withUser(admin.id, () => {
  database.putOne("tasks", {
    id: "task-admin",
    title: "Mine",
    status: "todo",
    createdAt: now,
    updatedAt: now,
  });
  database.putOne("tasks", {
    id: "task-admin",
    title: "Mine",
    status: "done",
    createdAt: now,
    updatedAt: now + 1,
  });
  database.putOne("logs", {
    id: "log-admin",
    date: "2026-10-27",
    content: "Admin journal",
    createdAt: now,
  });
});
if (database.listNotifications(admin.id).items.length !== adminInbox) fail("admin's own changes notified admins");

database.setLogAdminNote(admin, member.id, "log-1", "  Look again  ");
const notes = rows(member.id, "journal_note");
if (notes.length !== 1 || notes[0].subject !== "2026-10-27") fail("journal note did not notify the member");
if (notes[0].actorName !== "Ada") fail("journal note author was wrong");
if (database.listNotifications(other.id).unread !== 0) fail("another member received the note");
if (database.listNotifications(admin.id).items.some((row) => row.kind === "journal_note")) fail("admin received their own note");

database.setLogAdminNote(admin, member.id, "log-1", "   ");
if (rows(member.id, "journal_note").length !== 1) fail("clearing a note created a notification");

database.setLogAdminNote(admin, admin.id, "log-admin", "On my own journal");
if (database.listNotifications(admin.id).items.some((row) => row.kind === "journal_note")) fail("admin was notified of their own journal note");

const unread = database.listNotifications(admin.id).unread;
const moveId = moved[0].id;
database.markNotificationRead(other.id, moveId);
if (database.listNotifications(admin.id).unread !== unread) fail("another member marked an admin notification read");
database.markNotificationRead(admin.id, moveId);
if (database.listNotifications(admin.id).unread !== unread - 1) fail("mark read did not reduce the unread count");
database.markAllNotificationsRead(admin.id);
if (database.listNotifications(admin.id).unread !== 0) fail("mark all read left unread rows");

console.log("ok");
