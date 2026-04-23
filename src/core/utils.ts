import { format, isToday, isPast, differenceInDays, startOfDay, endOfDay } from "date-fns";
import type { Task, Goal, Session, TimeBlock } from "./types";

export const fmt = {
  time: (ts: number) => format(ts, "HH:mm"),
  date: (ts: number) => format(ts, "MMM d"),
  dateTime: (ts: number) => format(ts, "MMM d, HH:mm"),
  day: (ts: number) => format(ts, "EEE"),
  yyyymmdd: (ts: number | Date) => format(ts, "yyyy-MM-dd"),
  duration: (mins: number) => {
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
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

export const blocksOnDay = (blocks: TimeBlock[], date: Date) => {
  const s = startOfDay(date).getTime(), e = endOfDay(date).getTime();
  return blocks.filter((b) => b.startTime >= s && b.startTime <= e).sort((a, b) => a.startTime - b.startTime);
};

export const focusMinutesOnDay = (sessions: Session[], date: Date) =>
  Math.round(sessionsOnDay(sessions, date).reduce((a, s) => a + s.duration, 0) / 60);

export const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", todo: "To Do", in_progress: "In Progress", blocked: "Blocked", done: "Done",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Low", med: "Medium", high: "High", urgent: "Urgent",
};
