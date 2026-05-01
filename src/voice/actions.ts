// Layer 3: Action — execute an intent against the app's local data.
// This is the ONLY layer allowed to touch the store / IndexedDB.

import { useStore } from "@/core/store";
import { usePomodoro, useStopwatch } from "@/core/timer-store";
import { startOfDay, endOfDay, isToday } from "date-fns";
import type { Intent } from "./intentResolver";
import type { Task } from "@/core/types";
import { convertCurrency, fmtMoney } from "@/core/finance-utils";

export interface ActionResult {
  /** Spoken / displayed natural-language response. */
  message: string;
  /** Optional client-side navigation request. */
  navigateTo?: string;
}

function pendingTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== "done");
}

function todayTasks(tasks: Task[]): Task[] {
  return pendingTasks(tasks).filter((t) => t.deadline && isToday(new Date(t.deadline)));
}

function listTitles(tasks: Task[], max = 5): string {
  const titles = tasks.slice(0, max).map((t) => t.title);
  if (tasks.length > max) titles.push(`and ${tasks.length - max} more`);
  return titles.join(", ");
}

export async function handleIntent(intent: Intent | null): Promise<ActionResult> {
  if (!intent) {
    return { message: "I didn't understand. Try saying 'tasks today' or 'help'." };
  }

  const state = useStore.getState();

  switch (intent.type) {
    case "HELP":
      return {
        message:
          "You can ask me about tasks today, overdue tasks, your next task, your balance, expenses today, or say 'add task <title>', 'start pomodoro', or 'go to <page>'.",
      };

    case "GET_TASKS_TODAY": {
      const list = todayTasks(state.tasks);
      if (list.length === 0) return { message: "You have no tasks today." };
      return { message: `You have ${list.length} ${list.length === 1 ? "task" : "tasks"} today: ${listTitles(list)}.` };
    }

    case "GET_TASKS_OVERDUE": {
      const now = Date.now();
      const list = pendingTasks(state.tasks).filter((t) => t.deadline && t.deadline < startOfDay(new Date()).getTime());
      if (list.length === 0) return { message: "You have no overdue tasks." };
      return { message: `You have ${list.length} overdue ${list.length === 1 ? "task" : "tasks"}: ${listTitles(list)}.` };
    }

    case "GET_TASKS_PENDING": {
      const list = pendingTasks(state.tasks);
      if (list.length === 0) return { message: "You have no pending tasks." };
      return { message: `You have ${list.length} pending ${list.length === 1 ? "task" : "tasks"}.` };
    }

    case "COUNT_TASKS_DONE_TODAY": {
      const count = state.tasks.filter((t) => t.completedAt && isToday(new Date(t.completedAt))).length;
      return { message: `You've completed ${count} ${count === 1 ? "task" : "tasks"} today.` };
    }

    case "GET_NEXT_TASK": {
      const list = pendingTasks(state.tasks).sort((a, b) => {
        const ad = a.deadline ?? Number.POSITIVE_INFINITY;
        const bd = b.deadline ?? Number.POSITIVE_INFINITY;
        return ad - bd;
      });
      if (list.length === 0) return { message: "You have no pending tasks. Nice." };
      return { message: `Your next task is: ${list[0].title}.` };
    }

    case "ADD_TASK": {
      await state.upsertTask({ title: intent.title, status: "todo", priority: "med", tagIds: [] });
      return { message: `Added task: ${intent.title}.` };
    }

    case "START_POMODORO": {
      const s = state.settings;
      usePomodoro.getState().start(s.pomodoroFocus ?? 25, s.pomodoroBreak ?? 5);
      return { message: "Starting your focus session." };
    }

    case "STOP_POMODORO": {
      const s = state.settings;
      usePomodoro.getState().reset(s.pomodoroFocus ?? 25, s.pomodoroBreak ?? 5);
      return { message: "Pomodoro stopped." };
    }

    case "START_STOPWATCH": {
      useStopwatch.getState().start();
      return { message: "Stopwatch started." };
    }

    case "STOP_STOPWATCH": {
      useStopwatch.getState().pause();
      return { message: "Stopwatch paused." };
    }

    case "GET_BALANCE": {
      const base = state.settings.baseCurrency;
      const rate = state.settings.usdToLbpRate;
      const total = state.accounts.reduce((sum, a) => {
        return sum + convertCurrency(a.balance ?? 0, a.currency ?? "USD", base, rate);
      }, 0);
      return { message: `Your total balance is ${fmtMoney(total, base)}.` };
    }

    case "GET_EXPENSES_TODAY": {
      const base = state.settings.baseCurrency;
      const rate = state.settings.usdToLbpRate;
      const start = startOfDay(new Date()).getTime();
      const end = endOfDay(new Date()).getTime();
      const accCurrency = (id: string) =>
        state.accounts.find((a) => a.id === id)?.currency ?? "USD";
      const total = state.transactions
        .filter((t) => t.type === "expense" && t.date >= start && t.date <= end)
        .reduce((sum, t) => sum + convertCurrency(t.amount, accCurrency(t.accountId), base, rate), 0);
      if (total <= 0) return { message: "You haven't recorded any expenses today." };
      return { message: `You spent ${fmtMoney(total, base)} today.` };
    }

    case "NAVIGATE":
      return { message: `Opening ${intent.to}.`, navigateTo: intent.to };
  }
}
