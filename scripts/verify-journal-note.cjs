const fs = require("fs");
const os = require("os");
const path = require("path");
const database = require("../server/database.cjs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "life-os-journal-note-"));
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

database.withUser(member.id, () => {
  database.putOne("logs", {
    id: "log-1",
    date: "2026-10-27",
    content: "Did the work",
    createdAt: Date.now(),
    adminNote: "hack",
    adminNoteAt: 1,
    adminNoteBy: "Hacker",
  });
});

const untouched = database.withUser(member.id, () => database.getAll("logs").find((row) => row.id === "log-1"));
if (untouched.adminNote || untouched.adminNoteBy) fail("member putOne stored an admin note");

const written = database.setLogAdminNote(admin, member.id, "log-1", "  Look again  ");
if (written.adminNote !== "Look again") fail("note was not trimmed");
if (written.adminNoteBy !== "Ada") fail("note author was not the admin");

database.withUser(member.id, () => {
  database.putOne("logs", {
    id: "log-1",
    date: "2026-10-27",
    content: "Did the work, updated",
    createdAt: untouched.createdAt,
    adminNote: "wipe",
    adminNoteAt: 2,
    adminNoteBy: "Hacker",
  });
});
const kept = database.withUser(member.id, () => database.getAll("logs").find((row) => row.id === "log-1"));
if (kept.content !== "Did the work, updated") fail("member update did not save content");
if (kept.adminNote !== "Look again" || kept.adminNoteBy !== "Ada") fail("member update changed the admin note");

const cleared = database.setLogAdminNote(admin, member.id, "log-1", "   ");
if (cleared.adminNote || cleared.adminNoteAt || cleared.adminNoteBy) fail("blank note did not clear");

database.withUser(other.id, () => {
  database.putOne("logs", {
    id: "log-2",
    date: "2026-10-27",
    content: "Other person",
    createdAt: Date.now(),
  });
});
try {
  database.setLogAdminNote(admin, member.id, "log-2", "nope");
  fail("note was set on another user's log");
} catch (error) {
  if (error.message !== "Not found") fail(error.message);
}

database.withUser(member.id, () => {
  database.putOne("logs", {
    id: "log-3",
    date: "2026-10-26",
    content: "Yesterday",
    createdAt: Date.now() - 86400000,
  });
});
const sameDay = database.listJournalsByDate("2026-10-27");
const sameIds = sameDay.map((row) => row.id).sort();
if (sameIds.join() !== "log-1,log-2") fail(`expected log-1 and log-2, got ${sameIds.join()}`);
if (!sameDay.every((row) => row.userName)) fail("day list omitted the author");
if (sameDay.some((row) => row.id === "log-3")) fail("another day was included");
try {
  database.listJournalsByDate("");
  fail("missing date was accepted");
} catch (error) {
  if (error.message !== "Invalid date") fail(error.message);
}

database.withUser(admin.id, () => {
  database.putOne("logs", {
    id: "log-admin",
    date: "2026-10-27",
    content: "Admin wrote this",
    createdAt: Date.now(),
  });
});
const memberJournals = database.listMemberJournals(null);
if (memberJournals.some((row) => row.id === "log-admin")) fail("admin journal was included");
if (!memberJournals.some((row) => row.id === "log-1")) fail("member journal was missing");
if (database.listMemberJournals(admin.id).length) fail("admin id returned journals");
const counts = database.listMemberJournalCounts();
if (counts.some((row) => row.id === admin.id)) fail("admin was listed as a journal author");

console.log("ok");
