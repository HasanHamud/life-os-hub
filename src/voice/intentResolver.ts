// Layer 2: Intent — text to structured intent.
//
// IMPORTANT: This file is intentionally ISOLATED.
// - It MUST NOT import IndexedDB, the Zustand store, or React.
// - It MUST NOT execute any side effects.
// - Its only job: turn raw recognized text into a typed Intent (or null).
//
// Future upgrade path: when we add a local AI model (e.g. Ollama) we will
// only modify the bottom of `resolveIntent` to call the model when no rule
// matches. The signature stays the same, so UI / actions / voice IO are
// untouched.

export type Intent =
  | { type: "GET_TASKS_TODAY" }
  | { type: "GET_TASKS_OVERDUE" }
  | { type: "GET_TASKS_PENDING" }
  | { type: "COUNT_TASKS_DONE_TODAY" }
  | { type: "GET_NEXT_TASK" }
  | { type: "ADD_TASK"; title: string }
  | { type: "START_POMODORO" }
  | { type: "STOP_POMODORO" }
  | { type: "START_STOPWATCH" }
  | { type: "STOP_STOPWATCH" }
  | { type: "GET_BALANCE" }
  | { type: "GET_EXPENSES_TODAY" }
  | { type: "NAVIGATE"; to: string }
  | { type: "HELP" };

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[.?!,]+$/g, "").replace(/\s+/g, " ");
}

function hasAny(t: string, words: string[]): boolean {
  return words.some((w) => t.includes(w));
}

export async function resolveIntent(rawText: string): Promise<Intent | null> {
  const text = normalize(rawText || "");
  if (!text) return null;

  // ---- Help ----
  if (hasAny(text, ["help", "what can you do", "commands"])) {
    return { type: "HELP" };
  }

  // ---- Add task ("add task buy milk", "create task ...", "remind me to ...")
  const addMatch =
    text.match(/^(?:add|create|new)\s+(?:a\s+)?task\s+(?:to\s+|called\s+|named\s+)?(.+)$/) ||
    text.match(/^remind me to\s+(.+)$/) ||
    text.match(/^add\s+(.+?)\s+to\s+(?:my\s+)?tasks?$/);
  if (addMatch && addMatch[1]) {
    const title = addMatch[1].trim();
    if (title.length > 0) return { type: "ADD_TASK", title };
  }

  // ---- Tasks queries ----
  const isTaskish = hasAny(text, ["task", "tasks", "todo", "to do", "to-do"]);

  if (isTaskish && hasAny(text, ["today", "for today"])) return { type: "GET_TASKS_TODAY" };
  if (isTaskish && hasAny(text, ["overdue", "late", "missed"])) return { type: "GET_TASKS_OVERDUE" };
  if (isTaskish && hasAny(text, ["pending", "open", "remaining", "left"])) return { type: "GET_TASKS_PENDING" };
  if ((hasAny(text, ["how many", "count"])) && isTaskish && hasAny(text, ["done", "completed", "finished"])) {
    return { type: "COUNT_TASKS_DONE_TODAY" };
  }
  if (hasAny(text, ["next task", "what's next", "what is next", "next thing"])) {
    return { type: "GET_NEXT_TASK" };
  }
  if (isTaskish && !hasAny(text, ["today", "overdue", "pending", "next", "done", "completed"])) {
    return { type: "GET_TASKS_TODAY" };
  }

  // ---- Pomodoro / stopwatch ----
  if (hasAny(text, ["pomodoro", "focus timer"])) {
    if (hasAny(text, ["stop", "pause", "end"])) return { type: "STOP_POMODORO" };
    if (hasAny(text, ["start", "begin", "go"])) return { type: "START_POMODORO" };
  }
  if (hasAny(text, ["stopwatch", "timer"])) {
    if (hasAny(text, ["stop", "pause", "end"])) return { type: "STOP_STOPWATCH" };
    if (hasAny(text, ["start", "begin", "go"])) return { type: "START_STOPWATCH" };
  }

  // ---- Finance ----
  if (hasAny(text, ["balance", "net worth", "how much money", "total money"])) {
    return { type: "GET_BALANCE" };
  }
  if (hasAny(text, ["expense", "expenses", "spent", "spending"]) && hasAny(text, ["today"])) {
    return { type: "GET_EXPENSES_TODAY" };
  }

  // ---- Navigation ----
  const navTargets: Array<[string[], string]> = [
    [["dashboard", "home"], "/"],
    [["tasks page", "open tasks", "go to tasks"], "/tasks"],
    [["calendar"], "/calendar"],
    [["projects"], "/projects"],
    [["goals"], "/goals"],
    [["pomodoro"], "/pomodoro"],
    [["stopwatch"], "/stopwatch"],
    [["analytics"], "/analytics"],
    [["journal"], "/journal"],
    [["finance", "money page"], "/finance"],
    [["transactions"], "/finance/transactions"],
    [["budgets"], "/finance/budgets"],
    [["savings"], "/finance/savings"],
    [["settings"], "/settings"],
  ];
  if (hasAny(text, ["go to", "open", "show", "navigate to"])) {
    for (const [keywords, to] of navTargets) {
      if (hasAny(text, keywords)) return { type: "NAVIGATE", to };
    }
  }

  // ---- No rule matched ----
  // FUTURE: plug a local AI (Ollama) here. The contract stays the same:
  //   const aiIntent = await callOllama(text);
  //   if (aiIntent) return aiIntent;
  return null;
}
