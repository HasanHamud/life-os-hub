import { create } from "zustand";

export type PomodoroMode = "focus" | "break";

interface PomodoroState {
  mode: PomodoroMode;
  running: boolean;
  endsAt: number | null;
  remaining: number;
  totalSeconds: number;
  taskId?: string;
  projectId?: string;
  completedRounds: number;
  startedAt: number | null;

  init: (focusMin: number) => void;
  setTask: (taskId?: string) => void;
  setProject: (projectId?: string) => void;
  start: (focusMin: number, breakMin: number) => void;
  pause: () => void;
  reset: (focusMin: number, breakMin: number) => void;
  switchMode: (mode: PomodoroMode, focusMin: number, breakMin: number, longBreakMin: number, longEvery: number) => void;
  tickComplete: (focusMin: number, breakMin: number, longBreakMin: number, longEvery: number) => { startedAt: number; endedAt: number; duration: number; mode: PomodoroMode; taskId?: string; projectId?: string };
  hardReset: (focusMin: number) => void;
}

const KEY = "pomodoro-state-v1";
const load = (): Partial<PomodoroState> | null => {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
};
const persist = (s: PomodoroState) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      mode: s.mode, running: s.running, endsAt: s.endsAt, remaining: s.remaining,
      totalSeconds: s.totalSeconds, taskId: s.taskId, projectId: s.projectId, completedRounds: s.completedRounds, startedAt: s.startedAt,
    }));
  } catch { /* ignore */ }
};

export const usePomodoro = create<PomodoroState>((set, get) => {
  const saved = load();
  return {
    mode: (saved?.mode as PomodoroMode) ?? "focus",
    running: saved?.running ?? false,
    endsAt: saved?.endsAt ?? null,
    remaining: saved?.remaining ?? 25 * 60,
    totalSeconds: saved?.totalSeconds ?? 25 * 60,
    taskId: saved?.taskId,
    projectId: saved?.projectId,
    completedRounds: saved?.completedRounds ?? 0,
    startedAt: saved?.startedAt ?? null,

    init: (focusMin) => {
      const s = get();
      if (s.running || s.endsAt) return;
      const total = focusMin * 60;
      set({ totalSeconds: total, remaining: total });
    },
    setTask: (taskId) => { set({ taskId }); persist(get()); },
    setProject: (projectId) => { set({ projectId }); persist(get()); },

    start: (focusMin, breakMin) => {
      const s = get();
      const total = (s.mode === "focus" ? focusMin : breakMin) * 60;
      const remaining = s.remaining > 0 && s.remaining <= total ? s.remaining : total;
      const endsAt = Date.now() + remaining * 1000;
      const startedAt = s.startedAt ?? Date.now() - (total - remaining) * 1000;
      set({ running: true, endsAt, remaining, totalSeconds: total, startedAt });
      persist(get());
    },
    pause: () => {
      const s = get();
      if (!s.running || !s.endsAt) return;
      const remaining = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
      set({ running: false, endsAt: null, remaining });
      persist(get());
    },
    reset: (focusMin, breakMin) => {
      const s = get();
      const total = (s.mode === "focus" ? focusMin : breakMin) * 60;
      set({ running: false, endsAt: null, remaining: total, totalSeconds: total, startedAt: null });
      persist(get());
    },
    switchMode: (mode, focusMin, breakMin, longBreakMin, longEvery) => {
      const s = get();
      const isLong = mode === "break" && s.completedRounds > 0 && s.completedRounds % longEvery === 0;
      const total = (mode === "focus" ? focusMin : isLong ? longBreakMin : breakMin) * 60;
      set({ mode, running: false, endsAt: null, remaining: total, totalSeconds: total, startedAt: null });
      persist(get());
    },
    tickComplete: (focusMin, breakMin, longBreakMin, longEvery) => {
      const s = get();
      const startedAt = s.startedAt ?? Date.now() - s.totalSeconds * 1000;
      const endedAt = Date.now();
      const duration = Math.round((endedAt - startedAt) / 1000);
      const session = { startedAt, endedAt, duration, mode: s.mode, taskId: s.taskId, projectId: s.projectId };

      if (s.mode === "focus") {
        const next = s.completedRounds + 1;
        const isLong = next % longEvery === 0;
        const total = (isLong ? longBreakMin : breakMin) * 60;
        set({ mode: "break", completedRounds: next, running: false, endsAt: null, remaining: total, totalSeconds: total, startedAt: null });
      } else {
        const total = focusMin * 60;
        set({ mode: "focus", running: false, endsAt: null, remaining: total, totalSeconds: total, startedAt: null });
      }
      persist(get());
      return session;
    },
    hardReset: (focusMin) => {
      const total = focusMin * 60;
      set({ mode: "focus", running: false, endsAt: null, remaining: total, totalSeconds: total, startedAt: null, completedRounds: 0 });
      persist(get());
    },
  };
});

// ============ STOPWATCH ============
interface StopwatchState {
  running: boolean;
  startedAt: number | null;
  accumulatedMs: number;
  taskId?: string;
  projectId?: string;
  label?: string;

  start: () => void;
  pause: () => void;
  reset: () => void;
  setTask: (taskId?: string) => void;
  setProject: (projectId?: string) => void;
  setLabel: (label?: string) => void;
  stop: () => { startedAt: number; endedAt: number; durationMs: number; taskId?: string; projectId?: string; label?: string };
  getElapsedMs: () => number;
}

const SW_KEY = "stopwatch-state-v1";
const swLoad = (): Partial<StopwatchState> | null => {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(SW_KEY) || "null"); } catch { return null; }
};
const swPersist = (s: StopwatchState) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SW_KEY, JSON.stringify({
      running: s.running, startedAt: s.startedAt, accumulatedMs: s.accumulatedMs, taskId: s.taskId, projectId: s.projectId, label: s.label,
    }));
  } catch { /* ignore */ }
};

export const useStopwatch = create<StopwatchState>((set, get) => {
  const saved = swLoad();
  return {
    running: saved?.running ?? false,
    startedAt: saved?.startedAt ?? null,
    accumulatedMs: saved?.accumulatedMs ?? 0,
    taskId: saved?.taskId,
    projectId: saved?.projectId,
    label: saved?.label,

    start: () => {
      const s = get();
      if (s.running) return;
      set({ running: true, startedAt: Date.now() });
      swPersist(get());
    },
    pause: () => {
      const s = get();
      if (!s.running || !s.startedAt) return;
      const add = Date.now() - s.startedAt;
      set({ running: false, startedAt: null, accumulatedMs: s.accumulatedMs + add });
      swPersist(get());
    },
    reset: () => {
      set({ running: false, startedAt: null, accumulatedMs: 0 });
      swPersist(get());
    },
    setTask: (taskId) => { set({ taskId }); swPersist(get()); },
    setProject: (projectId) => { set({ projectId }); swPersist(get()); },
    setLabel: (label) => { set({ label }); swPersist(get()); },
    stop: () => {
      const s = get();
      const endedAt = Date.now();
      const liveAdd = s.running && s.startedAt ? endedAt - s.startedAt : 0;
      const durationMs = s.accumulatedMs + liveAdd;
      const startedAt = endedAt - durationMs;
      set({ running: false, startedAt: null, accumulatedMs: 0 });
      swPersist(get());
      return { startedAt, endedAt, durationMs, taskId: s.taskId, projectId: s.projectId, label: s.label };
    },
    getElapsedMs: () => {
      const s = get();
      const liveAdd = s.running && s.startedAt ? Date.now() - s.startedAt : 0;
      return s.accumulatedMs + liveAdd;
    },
  };
}); 