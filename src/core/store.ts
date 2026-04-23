import { create } from "zustand";
import { addDays, format, startOfDay } from "date-fns";
import {
  getAll, putOne, delOne, uid, getOne,
} from "./db";
import type {
  Task, TimeBlock, Project, Goal, Session, Tag, LogEntry, Settings, TaskStatus, Recurrence,
} from "./types";

interface State {
  loaded: boolean;
  tasks: Task[];
  timeBlocks: TimeBlock[];
  projects: Project[];
  goals: Goal[];
  sessions: Session[];
  tags: Tag[];
  logs: LogEntry[];
  settings: Settings;

  load: () => Promise<void>;

  // tasks
  upsertTask: (t: Partial<Task> & { title?: string }) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;

  // time blocks
  upsertBlock: (b: Partial<TimeBlock> & { startTime?: number; endTime?: number; title?: string }) => Promise<TimeBlock>;
  deleteBlock: (id: string) => Promise<void>;

  // projects
  upsertProject: (p: Partial<Project> & { name?: string }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;

  // goals
  upsertGoal: (g: Partial<Goal> & { title?: string }) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;

  // sessions
  addSession: (s: Omit<Session, "id">) => Promise<Session>;

  // tags
  upsertTag: (t: Partial<Tag> & { name?: string }) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;

  // logs
  upsertLog: (l: Partial<LogEntry> & { content?: string; date?: string }) => Promise<LogEntry>;
  deleteLog: (id: string) => Promise<void>;

  // settings
  updateSettings: (s: Partial<Settings>) => Promise<void>;

  // recurrence: ensure recurring task instances exist for the next N days
  materializeRecurring: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  id: "global",
  pomodoroFocus: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroLongEvery: 4,
  notificationsEnabled: false,
  workdayStart: 8,
  workdayEnd: 20,
};

export const useStore = create<State>((set, get) => ({
  loaded: false,
  tasks: [],
  timeBlocks: [],
  projects: [],
  goals: [],
  sessions: [],
  tags: [],
  logs: [],
  settings: DEFAULT_SETTINGS,

  load: async () => {
    const [tasks, timeBlocks, projects, goals, sessions, tags, logs] = await Promise.all([
      getAll<Task>("tasks"),
      getAll<TimeBlock>("timeBlocks"),
      getAll<Project>("projects"),
      getAll<Goal>("goals"),
      getAll<Session>("sessions"),
      getAll<Tag>("tags"),
      getAll<LogEntry>("logs"),
    ]);
    let settings = await getOne<Settings>("settings", "global");
    if (!settings) {
      settings = DEFAULT_SETTINGS;
      await putOne("settings", settings);
    }

    // Seed sample data on first run
    if (tasks.length === 0 && projects.length === 0 && tags.length === 0) {
      await seed();
      const [t2, b2, p2, g2, , tg2] = await Promise.all([
        getAll<Task>("tasks"),
        getAll<TimeBlock>("timeBlocks"),
        getAll<Project>("projects"),
        getAll<Goal>("goals"),
        getAll<Session>("sessions"),
        getAll<Tag>("tags"),
      ]);
      set({ tasks: t2, timeBlocks: b2, projects: p2, goals: g2, tags: tg2, sessions, logs, settings, loaded: true });
    } else {
      set({ tasks, timeBlocks, projects, goals, sessions, tags, logs, settings, loaded: true });
    }

    await get().materializeRecurring();
  },

  upsertTask: async (patch) => {
    const now = Date.now();
    const existing = patch.id ? get().tasks.find((x) => x.id === patch.id) : undefined;
    const task: Task = {
      id: existing?.id ?? uid(),
      title: patch.title ?? existing?.title ?? "Untitled",
      description: patch.description ?? existing?.description,
      status: patch.status ?? existing?.status ?? "todo",
      priority: patch.priority ?? existing?.priority ?? "med",
      effort: patch.effort ?? existing?.effort,
      deadline: patch.deadline ?? existing?.deadline,
      projectId: patch.projectId ?? existing?.projectId,
      goalId: patch.goalId ?? existing?.goalId,
      tagIds: patch.tagIds ?? existing?.tagIds ?? [],
      parentTaskId: patch.parentTaskId ?? existing?.parentTaskId,
      dependsOnIds: patch.dependsOnIds ?? existing?.dependsOnIds ?? [],
      recurrence: patch.recurrence ?? existing?.recurrence,
      recurrenceParentId: patch.recurrenceParentId ?? existing?.recurrenceParentId,
      completedAt:
        patch.status === "done"
          ? existing?.completedAt ?? now
          : patch.status && patch.status !== "done"
          ? undefined
          : existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await putOne("tasks", task);
    set((s) => ({
      tasks: existing ? s.tasks.map((x) => (x.id === task.id ? task : x)) : [...s.tasks, task],
    }));
    return task;
  },

  deleteTask: async (id) => {
    await delOne("tasks", id);
    // also remove subtasks
    const subs = get().tasks.filter((t) => t.parentTaskId === id);
    for (const s of subs) await delOne("tasks", s.id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id && t.parentTaskId !== id) }));
  },

  setTaskStatus: async (id, status) => {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    await get().upsertTask({ ...t, status });
  },

  upsertBlock: async (patch) => {
    const existing = patch.id ? get().timeBlocks.find((x) => x.id === patch.id) : undefined;
    const block: TimeBlock = {
      id: existing?.id ?? uid(),
      taskId: patch.taskId ?? existing?.taskId,
      title: patch.title ?? existing?.title ?? "Time Block",
      startTime: patch.startTime ?? existing?.startTime ?? Date.now(),
      endTime: patch.endTime ?? existing?.endTime ?? Date.now() + 3600_000,
      type: patch.type ?? existing?.type ?? "deep",
      isCompleted: patch.isCompleted ?? existing?.isCompleted ?? false,
      notes: patch.notes ?? existing?.notes,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("timeBlocks", block);
    set((s) => ({
      timeBlocks: existing ? s.timeBlocks.map((x) => (x.id === block.id ? block : x)) : [...s.timeBlocks, block],
    }));
    return block;
  },
  deleteBlock: async (id) => {
    await delOne("timeBlocks", id);
    set((s) => ({ timeBlocks: s.timeBlocks.filter((x) => x.id !== id) }));
  },

  upsertProject: async (patch) => {
    const existing = patch.id ? get().projects.find((x) => x.id === patch.id) : undefined;
    const p: Project = {
      id: existing?.id ?? uid(),
      name: patch.name ?? existing?.name ?? "Untitled Project",
      description: patch.description ?? existing?.description,
      color: patch.color ?? existing?.color ?? "#d4a574",
      archived: patch.archived ?? existing?.archived ?? false,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("projects", p);
    set((s) => ({ projects: existing ? s.projects.map((x) => (x.id === p.id ? p : x)) : [...s.projects, p] }));
    return p;
  },
  deleteProject: async (id) => {
    await delOne("projects", id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  upsertGoal: async (patch) => {
    const existing = patch.id ? get().goals.find((x) => x.id === patch.id) : undefined;
    const start = patch.startDate ?? existing?.startDate ?? Date.now();
    const dur = patch.durationDays ?? existing?.durationDays ?? 30;
    const g: Goal = {
      id: existing?.id ?? uid(),
      title: patch.title ?? existing?.title ?? "Untitled Goal",
      description: patch.description ?? existing?.description,
      durationDays: dur,
      startDate: start,
      endDate: patch.endDate ?? existing?.endDate ?? addDays(start, dur).getTime(),
      linkedTaskIds: patch.linkedTaskIds ?? existing?.linkedTaskIds ?? [],
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("goals", g);
    set((s) => ({ goals: existing ? s.goals.map((x) => (x.id === g.id ? g : x)) : [...s.goals, g] }));
    return g;
  },
  deleteGoal: async (id) => {
    await delOne("goals", id);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },

  addSession: async (s) => {
    const ses: Session = { id: uid(), ...s };
    await putOne("sessions", ses);
    set((st) => ({ sessions: [...st.sessions, ses] }));
    return ses;
  },

  upsertTag: async (patch) => {
    const existing = patch.id ? get().tags.find((x) => x.id === patch.id) : undefined;
    const t: Tag = {
      id: existing?.id ?? uid(),
      name: patch.name ?? existing?.name ?? "tag",
      color: patch.color ?? existing?.color ?? "#d4a574",
    };
    await putOne("tags", t);
    set((s) => ({ tags: existing ? s.tags.map((x) => (x.id === t.id ? t : x)) : [...s.tags, t] }));
    return t;
  },
  deleteTag: async (id) => {
    await delOne("tags", id);
    set((s) => ({ tags: s.tags.filter((t) => t.id !== id) }));
  },

  upsertLog: async (patch) => {
    const existing = patch.id ? get().logs.find((x) => x.id === patch.id) : undefined;
    const l: LogEntry = {
      id: existing?.id ?? uid(),
      date: patch.date ?? existing?.date ?? format(new Date(), "yyyy-MM-dd"),
      content: patch.content ?? existing?.content ?? "",
      relatedTaskId: patch.relatedTaskId ?? existing?.relatedTaskId,
      mood: patch.mood ?? existing?.mood,
      energy: patch.energy ?? existing?.energy,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await putOne("logs", l);
    set((s) => ({ logs: existing ? s.logs.map((x) => (x.id === l.id ? l : x)) : [...s.logs, l] }));
    return l;
  },
  deleteLog: async (id) => {
    await delOne("logs", id);
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) }));
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch, id: "global" as const };
    await putOne("settings", next);
    set({ settings: next });
  },

  materializeRecurring: async () => {
    const tasks = get().tasks;
    const templates = tasks.filter((t) => t.recurrence && t.recurrence.freq !== "none" && !t.recurrenceParentId);
    if (templates.length === 0) return;
    const horizonDays = 14;
    const today = startOfDay(new Date());
    for (const tpl of templates) {
      const r = tpl.recurrence as Recurrence;
      for (let i = 0; i < horizonDays; i++) {
        const day = addDays(today, i);
        let shouldCreate = false;
        if (r.freq === "daily") shouldCreate = true;
        else if (r.freq === "weekly" && r.weekdays?.includes(day.getDay())) shouldCreate = true;
        else if (r.freq === "custom" && r.intervalDays) {
          const diff = Math.floor((day.getTime() - startOfDay(tpl.createdAt).getTime()) / 86400000);
          shouldCreate = diff >= 0 && diff % r.intervalDays === 0;
        }
        if (!shouldCreate) continue;
        const dayStr = format(day, "yyyy-MM-dd");
        const exists = tasks.some(
          (t) => t.recurrenceParentId === tpl.id && t.deadline && format(t.deadline, "yyyy-MM-dd") === dayStr
        );
        if (exists) continue;
        await get().upsertTask({
          title: tpl.title,
          description: tpl.description,
          status: "todo",
          priority: tpl.priority,
          effort: tpl.effort,
          deadline: day.getTime(),
          projectId: tpl.projectId,
          goalId: tpl.goalId,
          tagIds: tpl.tagIds,
          recurrenceParentId: tpl.id,
        });
      }
    }
  },
}));

async function seed() {
  const projId = uid();
  const proj2 = uid();
  const goalId = uid();
  const tag1 = uid(), tag2 = uid(), tag3 = uid();

  await putOne("projects", { id: projId, name: "Life OS Launch", description: "Ship v1 of personal OS", color: "#d4a574", createdAt: Date.now() });
  await putOne("projects", { id: proj2, name: "Health & Fitness", description: "Habits, training, sleep", color: "#90b890", createdAt: Date.now() });

  await putOne("goals", {
    id: goalId, title: "Ship Life OS in 30 days", durationDays: 30,
    startDate: Date.now(), endDate: Date.now() + 30 * 86400000, linkedTaskIds: [], createdAt: Date.now(),
  });

  await putOne("tags", { id: tag1, name: "deep-work", color: "#d4a574" });
  await putOne("tags", { id: tag2, name: "admin", color: "#90b8c8" });
  await putOne("tags", { id: tag3, name: "health", color: "#a8c888" });

  const now = Date.now();
  const today = startOfDay(new Date()).getTime();
  const samples: Task[] = [
    { id: uid(), title: "Design dashboard layout", status: "in_progress", priority: "high", effort: 90, deadline: today + 18 * 3600000, projectId: projId, goalId, tagIds: [tag1], dependsOnIds: [], createdAt: now, updatedAt: now },
    { id: uid(), title: "Wire IndexedDB models", status: "done", priority: "urgent", effort: 60, projectId: projId, goalId, tagIds: [tag1], dependsOnIds: [], completedAt: now, createdAt: now - 86400000, updatedAt: now },
    { id: uid(), title: "Build Kanban board", status: "todo", priority: "high", effort: 120, deadline: today + 86400000, projectId: projId, goalId, tagIds: [tag1], dependsOnIds: [], createdAt: now, updatedAt: now },
    { id: uid(), title: "Morning run 5km", status: "todo", priority: "med", effort: 30, projectId: proj2, tagIds: [tag3], dependsOnIds: [], createdAt: now, updatedAt: now,
      recurrence: { freq: "weekly", weekdays: [1, 3, 5] } },
    { id: uid(), title: "Inbox zero", status: "backlog", priority: "low", effort: 20, tagIds: [tag2], dependsOnIds: [], createdAt: now, updatedAt: now },
    { id: uid(), title: "Plan week ahead", status: "blocked", priority: "med", tagIds: [tag2], dependsOnIds: [], createdAt: now, updatedAt: now },
  ];
  for (const t of samples) await putOne("tasks", t);

  // a couple sample blocks today
  const t1 = today + 9 * 3600000;
  await putOne("timeBlocks", { id: uid(), title: "Deep work: Dashboard", startTime: t1, endTime: t1 + 5400000, type: "deep", isCompleted: false, taskId: samples[0].id, createdAt: now });
  await putOne("timeBlocks", { id: uid(), title: "Email & admin", startTime: t1 + 6 * 3600000, endTime: t1 + 7 * 3600000, type: "shallow", isCompleted: false, createdAt: now });
}
