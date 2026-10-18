const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const database = require("../electron/database.cjs");
const bridgeCommands = require("../electron/bridge-commands.cjs");

const TOOLS = [
  {
    name: "list_projects",
    description: "List active Life OS Hub projects.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_project",
    description: "Create a project. Do not create a duplicate name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        category: { type: "string", description: "Work, Freelance, Personal, Studies, or University" },
        description: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_tasks",
    description: "List open tasks. Optionally filter by project name.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" } },
    },
  },
  {
    name: "add_task",
    description: "Add a task. Match project by name. Priority is low, med, high, or urgent. Default status is todo.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        project: { type: "string" },
        priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
        status: { type: "string", enum: ["backlog", "todo", "in_progress", "blocked", "done"] },
        description: { type: "string" },
        effort: { type: "number", description: "Minutes" },
        deadline: { type: "string", description: "ISO datetime" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update a task found by id or title. Can change title, priority, status, or project.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string", description: "Current title used to find the task" },
        newTitle: { type: "string" },
        priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
        status: { type: "string", enum: ["backlog", "todo", "in_progress", "blocked", "done"] },
        project: { type: "string" },
      },
    },
  },
  {
    name: "list_goals",
    description: "List goals.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_goal",
    description: "Add a goal. durationDays is usually 30, 60, or 90.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        durationDays: { type: "number" },
        description: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_notes",
    description: "List recent notes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_note",
    description: "Save a note. Type defaults to text.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        type: { type: "string", enum: ["text", "checklist", "code", "idea", "meeting", "doc", "sql", "api"] },
        project: { type: "string" },
        language: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_journal",
    description: "List recent journal entries.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_journal",
    description: "Add a journal entry. Mood and energy are optional integers from 1 to 5.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD, today, or tomorrow" },
        mood: { type: "number" },
        energy: { type: "number" },
      },
      required: ["content"],
    },
  },
  {
    name: "list_time_blocks",
    description: "List time blocks for a day.",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD, today, or tomorrow" } },
    },
  },
  {
    name: "add_time_block",
    description: "Add a time block. Type is work, freelance, personal, studies, or university.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO datetime" },
        end: { type: "string", description: "ISO datetime" },
        type: { type: "string", enum: ["work", "freelance", "personal", "studies", "university"] },
        notes: { type: "string" },
      },
      required: ["title", "start", "end", "type"],
    },
  },
  {
    name: "add_focus",
    description: "Log focus minutes for a day without starting the on-screen timer.",
    inputSchema: {
      type: "object",
      properties: {
        minutes: { type: "number" },
        date: { type: "string" },
        note: { type: "string" },
      },
      required: ["minutes"],
    },
  },
  {
    name: "list_concepts",
    description: "List learning concepts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_concept",
    description: "Add a learning concept. Clarity is 1 to 5.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subject: { type: "string" },
        topic: { type: "string" },
        clarity: { type: "number" },
        phase: { type: "number" },
        notes: { type: "string" },
      },
      required: ["title", "subject"],
    },
  },
  {
    name: "list_insights",
    description: "List learning insights.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_insight",
    description: "Add a learning insight.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        topic: { type: "string" },
        keyIdea: { type: "string" },
        insights: { type: "string" },
        mistakes: { type: "string" },
        date: { type: "string" },
      },
      required: ["subject", "keyIdea"],
    },
  },
  {
    name: "list_problems",
    description: "List practice problems.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_problem",
    description: "Add a practice problem. Difficulty is 1 to 5.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subject: { type: "string" },
        difficulty: { type: "number" },
        source: { type: "string" },
        patternClass: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title", "subject"],
    },
  },
  {
    name: "list_accounts",
    description: "List finance accounts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_categories",
    description: "List finance categories.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_transactions",
    description: "List recent transactions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_transaction",
    description: "Log an expense, income, or transfer against an existing account. Repeat amount, account, and category to the user after it succeeds. Do not create accounts.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["expense", "income", "transfer"] },
        amount: { type: "number" },
        account: { type: "string" },
        toAccount: { type: "string", description: "Required for transfers" },
        category: { type: "string" },
        note: { type: "string" },
        date: { type: "string" },
      },
      required: ["type", "amount", "account"],
    },
  },
];

function userDataDirs() {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return [
    path.join(appData, "Life OS Hub"),
    path.join(appData, "life-os-hub"),
  ];
}

function readBridge() {
  for (const dir of userDataDirs()) {
    const file = path.join(dir, "life-os-bridge.json");
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data.port && data.token && data.dbPath) return data;
    } catch {}
  }
  return null;
}

function findDbPath(preferred) {
  if (preferred && fs.existsSync(preferred)) return preferred;
  const found = userDataDirs()
    .map((dir) => path.join(dir, "life-os.db"))
    .filter((file) => fs.existsSync(file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return found[0] || null;
}

function postCommand(bridge, action, args) {
  const body = JSON.stringify({ action, ...args });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: bridge.port,
      path: "/command",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-life-os-token": bridge.token,
      },
      timeout: 1500,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = { ok: false, error: data || "Bad response" }; }
        if (res.statusCode === 401) {
          const error = new Error(parsed.error || "Unauthorized");
          error.noFallback = true;
          reject(error);
          return;
        }
        resolve(parsed);
      });
    });
    req.on("timeout", () => req.destroy(new Error("Bridge timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

let dbReady = false;

function openFallback(dbPath) {
  if (!dbPath) {
    return { ok: false, error: "Life OS database not found. Open the app once so it can create life-os.db." };
  }
  if (!dbReady) {
    database.openAt(dbPath);
    dbReady = true;
  }
  return null;
}

async function dispatch(action, args) {
  const bridge = readBridge();
  if (bridge) {
    try {
      return await postCommand(bridge, action, args);
    } catch (error) {
      if (error.noFallback) return { ok: false, error: error.message };
    }
  }
  const failed = openFallback(findDbPath(bridge && bridge.dbPath));
  if (failed) return failed;
  return bridgeCommands.handle(action, args || {});
}

function send(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function onMessage(message) {
  const { id, method, params } = message;
  if (id === undefined || id === null) return;

  if (method === "initialize") {
    reply(id, {
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "life-os", version: "1.0.0" },
    });
    return;
  }
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (method === "tools/list") {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === "tools/call") {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    const known = TOOLS.some((tool) => tool.name === name);
    if (!known) {
      reply(id, { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true });
      return;
    }
    try {
      const result = await dispatch(name, args);
      reply(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: result.ok === false,
      });
    } catch (error) {
      reply(id, { content: [{ type: "text", text: error.message || "Command failed" }], isError: true });
    }
    return;
  }
  replyError(id, -32601, `Method not found: ${method}`);
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = Buffer.alloc(0);
      return;
    }
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.slice(start, start + length).toString("utf8");
    buffer = buffer.slice(start + length);
    try {
      onMessage(JSON.parse(body));
    } catch (error) {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: error.message } });
    }
  }
});
process.stdin.on("end", () => process.exit(0));
