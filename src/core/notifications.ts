import i18n from "@/core/i18n";
import { authState, queueWorkspaceView } from "@/core/session";

export type Notice = {
  id: string;
  actorId: string;
  actorName: string;
  kind: "journal_note" | "journal_added" | "task_created" | "task_moved";
  subject: string;
  count: number;
  href: string;
  readAt: number | null;
  createdAt: number;
};

let items: Notice[] = [];
let unread = 0;
let primed = false;
let chain: Promise<void> = Promise.resolve();
const seen = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeNotifications(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notificationState() {
  return { items, unread };
}

export function opensMemberWorkspace(href: string) {
  return href === "/tasks" || href.startsWith("/tasks/");
}

export function notificationSentence(row: Notice) {
  if (row.kind === "task_moved" && row.count > 1) {
    return i18n.t("notifications.task_moved_many", { name: row.actorName, count: row.count });
  }
  return i18n.t(`notifications.${row.kind}`, { name: row.actorName, subject: row.subject });
}

function desktopNotice(row: Notice) {
  if (!window.isSecureContext || !("Notification" in window) || Notification.permission !== "granted") return;
  const popup = new Notification(i18n.t("notifications.title"), {
    body: notificationSentence(row),
    tag: row.id,
  });
  popup.onclick = () => {
    window.focus();
    const me = authState().user;
    if (me?.role === "admin" && me.id !== row.actorId && opensMemberWorkspace(row.href)) {
      queueWorkspaceView({ id: row.actorId, name: row.actorName });
    }
    void markNotificationRead(row.id).finally(() => window.location.assign(row.href));
  };
}

export function loadNotifications(live = false) {
  const run = chain.then(async () => {
    const res = await fetch("/api/notifications", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    const next: Notice[] = Array.isArray(data.items) ? data.items : [];
    if (!primed) {
      for (const row of next) seen.add(row.id);
      primed = true;
    } else if (live) {
      for (const row of next) {
        if (row.readAt || seen.has(row.id)) continue;
        seen.add(row.id);
        desktopNotice(row);
      }
    }
    items = next;
    unread = Number(data.unread) || 0;
    emit();
  });
  chain = run.then(() => undefined, () => undefined);
  return chain;
}

export async function markNotificationRead(id: string) {
  const row = items.find((item) => item.id === id);
  await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
    credentials: "include",
  });
  if (row && !row.readAt) {
    items = items.map((item) => (item.id === id ? { ...item, readAt: Date.now() } : item));
    unread = Math.max(0, unread - 1);
    emit();
  }
}

export async function markAllNotificationsRead() {
  await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
  const now = Date.now();
  items = items.map((item) => ({ ...item, readAt: item.readAt || now }));
  unread = 0;
  emit();
}
