import { create } from "zustand";
import { getConfig, setConfig } from "./db";

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

const POMO_KEY = "pomodoro-state";
const POMO_LEGACY_KEY = "pomodoro-state-v1";
let timersReady = false;

function snapshotPomodoro(s: PomodoroState) {
  return {
    mode: s.mode, running: s.running, endsAt: s.endsAt, remaining: s.remaining,
    totalSeconds: s.totalSeconds, taskId: s.taskId, projectId: s.projectId,
    completedRounds: s.completedRounds, startedAt: s.startedAt,
  };
}

const persist = (s: PomodoroState) => {
  if (!timersReady) return;
  void setConfig(POMO_KEY, JSON.stringify(snapshotPomodoro(s))).catch(() => { /* ignore */ });
};

export const usePomodoro = create<PomodoroState>((set, get) => {
  return {
    mode: "focus",
    running: false,
    endsAt: null,
    remaining: 25 * 60,
    totalSeconds: 25 * 60,
    taskId: undefined,
    projectId: undefined,
    completedRounds: 0,
    startedAt: null,

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

const SW_KEY = "stopwatch-state";
const SW_LEGACY_KEY = "stopwatch-state-v1";

function snapshotStopwatch(s: StopwatchState) {
  return {
    running: s.running, startedAt: s.startedAt, accumulatedMs: s.accumulatedMs,
    taskId: s.taskId, projectId: s.projectId, label: s.label,
  };
}

const swPersist = (s: StopwatchState) => {
  if (!timersReady) return;
  void setConfig(SW_KEY, JSON.stringify(snapshotStopwatch(s))).catch(() => { /* ignore */ });
};

export const useStopwatch = create<StopwatchState>((set, get) => {
  return {
    running: false,
    startedAt: null,
    accumulatedMs: 0,
    taskId: undefined,
    projectId: undefined,
    label: undefined,

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

async function loadTimer(key: string, legacyKey: string): Promise<string | null> {
  const saved = await getConfig(key);
  if (saved) return saved;
  let legacy: string | null = null;
  try { legacy = localStorage.getItem(legacyKey); } catch { legacy = null; }
  if (!legacy) return null;
  await setConfig(key, legacy);
  try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
  return legacy;
}

function parseTimer(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function hydrateTimers() {
  const [pomoRaw, swRaw] = await Promise.all([
    loadTimer(POMO_KEY, POMO_LEGACY_KEY),
    loadTimer(SW_KEY, SW_LEGACY_KEY),
  ]);
  const pomo = parseTimer(pomoRaw);
  const sw = parseTimer(swRaw);
  if (pomo) {
    usePomodoro.setState({
      mode: pomo.mode === "break" ? "break" : "focus",
      running: Boolean(pomo.running),
      endsAt: typeof pomo.endsAt === "number" ? pomo.endsAt : null,
      remaining: typeof pomo.remaining === "number" ? pomo.remaining : 25 * 60,
      totalSeconds: typeof pomo.totalSeconds === "number" ? pomo.totalSeconds : 25 * 60,
      taskId: typeof pomo.taskId === "string" ? pomo.taskId : undefined,
      projectId: typeof pomo.projectId === "string" ? pomo.projectId : undefined,
      completedRounds: typeof pomo.completedRounds === "number" ? pomo.completedRounds : 0,
      startedAt: typeof pomo.startedAt === "number" ? pomo.startedAt : null,
    });
  }
  if (sw) {
    useStopwatch.setState({
      running: Boolean(sw.running),
      startedAt: typeof sw.startedAt === "number" ? sw.startedAt : null,
      accumulatedMs: typeof sw.accumulatedMs === "number" ? sw.accumulatedMs : 0,
      taskId: typeof sw.taskId === "string" ? sw.taskId : undefined,
      projectId: typeof sw.projectId === "string" ? sw.projectId : undefined,
      label: typeof sw.label === "string" ? sw.label : undefined,
    });
  }
  timersReady = true;
} 