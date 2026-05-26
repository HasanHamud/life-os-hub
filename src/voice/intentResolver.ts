// Layer 2: Intent — text to structured intent.
//
// IMPORTANT: This file is intentionally ISOLATED.
// - It MUST NOT import IndexedDB, the Zustand store, or React.
// - It MUST NOT execute any side effects outside of intent resolution.
// - Its only job: turn raw recognized text into a typed Intent (or null).

export type Intent =
  | { type: "GET_TASKS_TODAY" }
  | { type: "GET_TASKS_OVERDUE" }
  | { type: "GET_TASKS_PENDING" }
  | { type: "COUNT_TASKS_DONE_TODAY" }
  | { type: "GET_NEXT_TASK" }
  | {
      type: "ADD_TASK";
      title: string;
      date?: string;
      time?: string;
      priority?: "low" | "medium" | "high";
      label?: string;
    }
  | { type: "START_POMODORO" }
  | { type: "STOP_POMODORO" }
  | { type: "START_STOPWATCH" }
  | { type: "STOP_STOPWATCH" }
  | { type: "GET_BALANCE" }
  | { type: "GET_EXPENSES_TODAY" }
  | { type: "NAVIGATE"; to: string }
  | { type: "HELP" };

// -------------------- Helpers --------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.?!,]+$/g, "")
    .replace(/\s+/g, " ");
}

function hasAny(t: string, words: string[]): boolean {
  return words.some((w) => t.includes(w));
}

function isValidIntent(obj: any): obj is Intent {
  return obj && typeof obj.type === "string";
}

// -------------------- Ollama AI --------------------

async function askOllama(text: string): Promise<Intent | null> {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3",
        stream: false,
        prompt: `
You are a strict JSON command generator.

RULES:
- Return ONLY valid JSON
- No explanation
- No extra text
- No markdown

INTENT:
ADD_TASK requires:
- title (clean text ONLY, no date/time words)
- date (YYYY-MM-DD)
- time (HH:mm)

CRITICAL:
- REMOVE words like "tomorrow", "Sunday", "at 5pm" from title
- Title must ONLY contain the task name

DATE RULES:
- "today", "tomorrow", weekdays → YYYY-MM-DD
- "next Sunday" = next upcoming Sunday

TIME RULES:
- Convert "2pm", "5:30 pm" → "HH:mm"

EXAMPLES:

User: add task tomorrow at 5pm called gym
Output:
{
  "type": "ADD_TASK",
  "title": "gym",
  "date": "2026-05-04",
  "time": "17:00"
}

User: remind me to study sunday at 3pm
Output:
{
  "type": "ADD_TASK",
  "title": "study",
  "date": "2026-05-05",
  "time": "15:00"
}

User: "${text}"

Return JSON:
`,
      }),
    });

    const data = await res.json();
    const raw = data.response?.trim();

    // Extract only JSON part (very important)
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) return null;

    const clean = raw.slice(start, end + 1);

    const parsed = JSON.parse(clean);

    return parsed;
  } catch (err) {
    console.error("Ollama error:", err);
    return null;
  }
}

// -------------------- Main Resolver --------------------

export async function resolveIntent(rawText: string): Promise<Intent | null> {
  const text = normalize(rawText || "");
  if (!text) return null;

  // ---- Help ----
  if (hasAny(text, ["help", "what can you do", "commands"])) {
    return { type: "HELP" };
  }

  // ---- Add task (simple cases handled locally) ----
  const addMatch =
    text.match(/^(?:add|create|new)\s+(?:a\s+)?task\s+(?:to\s+|called\s+|named\s+)?(.+)$/) ||
    text.match(/^remind me to\s+(.+)$/) ||
    text.match(/^add\s+(.+?)\s+to\s+(?:my\s+)?tasks?$/);

  if (addMatch && addMatch[1]) {
    const title = addMatch[1].trim();
    if (title.length > 0) {
      return { type: "ADD_TASK", title };
    }
  }

  // ---- Tasks queries ----
  const isTaskish = hasAny(text, ["task", "tasks", "todo", "to do", "to-do"]);

  if (isTaskish && hasAny(text, ["today", "for today"]))
    return { type: "GET_TASKS_TODAY" };

  if (isTaskish && hasAny(text, ["overdue", "late", "missed"]))
    return { type: "GET_TASKS_OVERDUE" };

  if (isTaskish && hasAny(text, ["pending", "open", "remaining", "left"]))
    return { type: "GET_TASKS_PENDING" };

  if (
    hasAny(text, ["how many", "count"]) &&
    isTaskish &&
    hasAny(text, ["done", "completed", "finished"])
  ) {
    return { type: "COUNT_TASKS_DONE_TODAY" };
  }

  if (hasAny(text, ["next task", "what's next", "what is next"])) {
    return { type: "GET_NEXT_TASK" };
  }

  if (
    isTaskish &&
    !hasAny(text, ["today", "overdue", "pending", "next", "done"])
  ) {
    return { type: "GET_TASKS_TODAY" };
  }

  // ---- Pomodoro / stopwatch ----
  if (hasAny(text, ["pomodoro", "focus timer"])) {
    if (hasAny(text, ["stop", "pause", "end"]))
      return { type: "STOP_POMODORO" };
    if (hasAny(text, ["start", "begin", "go"]))
      return { type: "START_POMODORO" };
  }

  if (hasAny(text, ["stopwatch", "timer"])) {
    if (hasAny(text, ["stop", "pause", "end"]))
      return { type: "STOP_STOPWATCH" };
    if (hasAny(text, ["start", "begin", "go"]))
      return { type: "START_STOPWATCH" };
  }

  // ---- Finance ----
  if (hasAny(text, ["balance", "net worth", "money"])) {
    return { type: "GET_BALANCE" };
  }

  if (
    hasAny(text, ["expense", "expenses", "spent"]) &&
    hasAny(text, ["today"])
  ) {
    return { type: "GET_EXPENSES_TODAY" };
  }

  // ---- Navigation ----
  const navTargets: Array<[string[], string]> = [
    [["dashboard", "home"], "/"],
    [["tasks"], "/tasks"],
    [["calendar"], "/calendar"],
    [["projects"], "/projects"],
    [["goals"], "/goals"],
    [["pomodoro"], "/pomodoro"],
    [["stopwatch"], "/stopwatch"],
    [["analytics"], "/analytics"],
    [["journal"], "/journal"],
    [["finance"], "/finance"],
    [["transactions"], "/finance/transactions"],
    [["budgets"], "/finance/budgets"],
    [["savings"], "/finance/savings"],
    [["settings"], "/settings"],
  ];

  if (hasAny(text, ["go to", "open", "navigate"])) {
    for (const [keywords, to] of navTargets) {
      if (hasAny(text, keywords)) return { type: "NAVIGATE", to };
    }
  }

  // -------------------- AI FALLBACK --------------------
  const aiIntent = await askOllama(text);

  if (isValidIntent(aiIntent)) {
    return aiIntent;
  }

  return null;
}