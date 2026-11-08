import { format, isToday, isPast, differenceInDays, startOfDay, endOfDay } from "date-fns";
import type { Task, Goal, Session } from "./types";
import i18n from "./i18n";
import { dateFnsLocale, latinDigits } from "./locale";

export function formatWhen(date: Date | number, pattern: string) {
  return latinDigits(format(date, pattern, { locale: dateFnsLocale() }));
}

export const fmt = {
  time: (ts: number) => formatWhen(ts, "HH:mm"),
  date: (ts: number) => formatWhen(ts, "MMM d"),
  dateTime: (ts: number) => formatWhen(ts, "MMM d, HH:mm"),
  day: (ts: number) => formatWhen(ts, "EEE"),
  deadline: (ts: number) => formatWhen(ts, "EEE, MMM d, HH:mm"),
  yyyymmdd: (ts: number | Date) => format(ts, "yyyy-MM-dd"),
  duration: (mins: number) => {
    const n = Math.round(mins);
    if (n < 60) return i18n.t("time.min", { count: n });
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? i18n.t("time.hourMin", { h, m }) : i18n.t("time.hour", { count: h });
  },
};

export const isOverdue = (t: Task) =>
  t.status !== "done" && !!t.deadline && isPast(t.deadline) && !isToday(t.deadline);

export const isDueToday = (t: Task) => !!t.deadline && isToday(t.deadline);

export const taskAge = (t: Task) =>
  Math.max(0, differenceInDays(new Date(), t.createdAt));

// Priority weights for auto-sort
const PRIO_WEIGHT = { urgent: 1000, high: 500, med: 100, low: 10 } as const;
export const taskScore = (t: Task) => {
  let s = PRIO_WEIGHT[t.priority];
  if (isOverdue(t)) s += 800;
  if (isDueToday(t)) s += 400;
  s += Math.min(taskAge(t), 30) * 5;
  if (t.status === "in_progress") s += 50;
  return s;
};

export const goalProgress = (g: Goal, tasks: Task[]) => {
  const linked = tasks.filter((t) => t.goalId === g.id || g.linkedTaskIds.includes(t.id));
  if (linked.length === 0) return 0;
  return Math.round((linked.filter((t) => t.status === "done").length / linked.length) * 100);
};

export const projectProgress = (projectId: string, tasks: Task[]) => {
  const linked = tasks.filter((t) => t.projectId === projectId);
  if (linked.length === 0) return 0;
  return Math.round((linked.filter((t) => t.status === "done").length / linked.length) * 100);
};

export const sessionsOnDay = (sessions: Session[], date: Date) => {
  const s = startOfDay(date).getTime(), e = endOfDay(date).getTime();
  return sessions.filter((x) => x.startTime >= s && x.startTime <= e && x.type === "focus");
};

export const focusMinutesOnDay = (sessions: Session[], date: Date) =>
  Math.round(sessionsOnDay(sessions, date).reduce((a, s) => a + s.duration, 0) / 60);

export const STATUS_LABEL: Record<string, string> = {
  get backlog() { return i18n.t("status.backlog"); },
  get todo() { return i18n.t("status.todo"); },
  get in_progress() { return i18n.t("status.in_progress"); },
  get blocked() { return i18n.t("status.blocked"); },
  get done() { return i18n.t("status.done"); },
};

export const PRIORITY_LABEL: Record<string, string> = {
  get low() { return i18n.t("priority.low"); },
  get med() { return i18n.t("priority.med"); },
  get high() { return i18n.t("priority.high"); },
  get urgent() { return i18n.t("priority.urgent"); },
};
