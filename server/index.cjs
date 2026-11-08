const fs = require("fs");
const http = require("http");
const path = require("path");

const database = require("./database.cjs");

const auth = require("./auth.cjs");

const PORT = Number(process.env.PORT) || 9090;
const HOST = process.env.LIFE_OS_HOST || "127.0.0.1";
const BODY_LIMIT = 20_000_000;
const CONFIG_KEY = /^[a-z0-9-]{1,64}$/i;
const COOKIE = "life_os_session";
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60;
const loginAttempts = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".map": "application/json",
};

const clients = new Set();

function pushEvent(event) {
  const body = event.type === "changed" ? "data: changed\n\n" : "event: notification\ndata: ping\n\n";
  for (const client of clients) {
    if (!event.userIds.includes(client.userId)) continue;
    try {
      client.res.write(body);
    } catch {
      clients.delete(client);
    }
  }
}

database.onWorkspaceEvent(pushEvent);

function send(res, status, payload, extra) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extra,
  });
  res.end(body);
}

function readCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sessionCookie(token) {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

function clearCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function currentSession(req) {
  const token = readCookies(req)[COOKIE];
  if (!token) return null;
  const user = database.userForToken(auth.hashToken(token));
  return user ? { user, token } : null;
}

function tooManyLogins(ip) {
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  loginAttempts.set(ip, recent);
  return recent.length > 10;
}

function workspaceId(req, user) {
  const header = req.headers["x-life-os-user"];
  if (!header || header === user.id) return user.id;
  if (user.role !== "admin") {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }
  const viewed = database.findUser(String(header));
  if (!viewed) throw new Error("Unknown user");
  return viewed.id;
}

async function handleAuth(req, res, parts) {
  if (req.method === "GET" && parts.length === 3 && parts[2] === "me") {
    const session = currentSession(req);
    send(res, 200, { needsSetup: database.needsSetup(), user: session ? session.user : null });
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "setup") {
    const body = await readJson(req);
    const user = database.setupAdmin(body);
    const token = database.loginUser(body.email, body.password).token;
    send(res, 200, { user }, { "Set-Cookie": sessionCookie(token) });
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "login") {
    if (tooManyLogins(req.socket.remoteAddress || "")) {
      send(res, 429, { error: "Too many sign-in attempts. Wait a minute." });
      return;
    }
    const body = await readJson(req);
    const result = database.loginUser(body.email, body.password);
    if (!result) {
      send(res, 401, { error: "Invalid email or password" });
      return;
    }
    send(res, 200, { user: result.user }, { "Set-Cookie": sessionCookie(result.token) });
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "logout") {
    const token = readCookies(req)[COOKIE];
    if (token) database.deleteSession(auth.hashToken(token));
    send(res, 200, { ok: true }, { "Set-Cookie": clearCookie() });
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "profile") {
    const session = currentSession(req);
    if (!session) {
      send(res, 401, { error: "Sign in required" });
      return;
    }
    const user = database.updateOwnAccount(session.user.id, auth.hashToken(session.token), await readJson(req));
    send(res, 200, { user });
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "avatar") {
    const session = currentSession(req);
    if (!session) {
      send(res, 401, { error: "Sign in required" });
      return;
    }
    const body = await readJson(req);
    const user = database.setOwnAvatar(session.user.id, body.avatar ?? null);
    send(res, 200, { user });
    return;
  }
  send(res, 404, { error: "Not found" });
}

async function handleAdmin(req, res, parts, actor) {
  if (req.method === "GET" && parts.length === 3 && parts[2] === "people") {
    send(res, 200, database.listPeople());
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "people") {
    send(res, 200, database.createMember(await readJson(req)));
    return;
  }
  if (req.method === "POST" && parts.length === 5 && parts[2] === "people" && parts[4] === "active") {
    const body = await readJson(req);
    send(res, 200, database.setUserActive(actor.id, parts[3], !!body.active));
    return;
  }
  if (req.method === "POST" && parts.length === 5 && parts[2] === "people" && parts[4] === "password") {
    const body = await readJson(req);
    database.setUserPassword(actor.id, parts[3], body.password);
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && parts.length === 5 && parts[2] === "people" && parts[4] === "journals") {
    send(res, 200, database.listUserJournals(parts[3]));
    return;
  }
  if (req.method === "POST" && parts.length === 7 && parts[2] === "people" && parts[4] === "journals" && parts[6] === "note") {
    const body = await readJson(req);
    send(res, 200, database.setLogAdminNote(actor, parts[3], parts[5], body.note));
    return;
  }
  if (req.method === "GET" && parts.length === 3 && parts[2] === "journals") {
    const query = new URL(req.url, "http://127.0.0.1").searchParams;
    const userId = query.get("userId");
    const date = query.get("date");
    const people = database.listMemberJournalCounts();
    const entries = date
      ? database.listJournalsByDate(date).filter((row) => !userId || row.userId === userId)
      : database.listMemberJournals(userId);
    // #region agent log
    fetch("http://127.0.0.1:7358/ingest/16520233-05b9-4a47-9ef8-1e4a695755c4",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"ae3054"},body:JSON.stringify({sessionId:"ae3054",runId:"post-fix",hypothesisId:"C",location:"server/index.cjs:journals",message:"member journals listed",data:{userId:userId||null,people:people.length,entries:entries.length,adminEntries:0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    send(res, 200, { people, entries });
    return;
  }
  if (req.method === "GET" && parts.length === 3 && parts[2] === "overview") {
    send(res, 200, database.adminOverview());
    return;
  }
  if (req.method === "GET" && parts.length === 3 && parts[2] === "activity") {
    send(res, 200, database.listActivity());
    return;
  }
  if (req.method === "POST" && parts.length === 3 && parts[2] === "activity") {
    const body = await readJson(req);
    send(res, 200, database.deleteActivityRange(body.from, body.to));
    return;
  }
  send(res, 404, { error: "Not found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

function assertConfigKey(key) {
  if (!CONFIG_KEY.test(key || "")) throw new Error("Invalid config key");
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return false;

  try {
    if (parts[1] === "auth") {
      await handleAuth(req, res, parts);
      return true;
    }

    const session = currentSession(req);
    if (!session) {
      send(res, 401, { error: "Sign in required" });
      return true;
    }

    if (req.method === "GET" && parts.length === 2 && parts[1] === "people") {
      send(res, 200, database.listDirectory());
      return true;
    }

    if (parts[1] === "notifications") {
      if (req.method === "GET" && parts.length === 2) {
        send(res, 200, database.listNotifications(session.user.id));
        return true;
      }
      if (req.method === "POST" && parts.length === 3 && parts[2] === "read-all") {
        database.markAllNotificationsRead(session.user.id);
        send(res, 200, { ok: true });
        return true;
      }
      if (req.method === "POST" && parts.length === 4 && parts[3] === "read") {
        database.markNotificationRead(session.user.id, parts[2]);
        send(res, 200, { ok: true });
        return true;
      }
      send(res, 404, { error: "Not found" });
      return true;
    }

    if (req.method === "GET" && parts.length === 2 && parts[1] === "events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      const client = { res, userId: session.user.id };
      clients.add(client);
      req.on("close", () => clients.delete(client));
      return true;
    }

    if (parts[1] === "admin") {
      if (session.user.role !== "admin") {
        send(res, 403, { error: "Admin only" });
        return true;
      }
      await handleAdmin(req, res, parts, session.user);
      return true;
    }

    const userId = workspaceId(req, session.user);
    await database.withUser(userId, async () => {
    if (req.method === "POST" && url.pathname === "/api/clear") {
      database.clearAll();
      send(res, 200, { ok: true });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/export") {
      send(res, 200, database.exportAll());
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/import") {
      database.importAll(await readJson(req));
      send(res, 200, { ok: true });
      return true;
    }

    if (parts[1] === "config" && parts[2] && !parts[3]) {
      assertConfigKey(parts[2]);
      if (req.method === "GET") {
        send(res, 200, { value: database.getConfig(parts[2]) });
        return true;
      }
      if (req.method === "PUT") {
        const body = await readJson(req);
        if (typeof body.value !== "string") throw new Error("Config value must be a string");
        database.setConfig(parts[2], body.value);
        send(res, 200, { ok: true });
        return true;
      }
    }

    if (parts[1] && parts[2] === "clear" && !parts[3] && req.method === "POST") {
      database.clearStore(parts[1]);
      send(res, 200, { ok: true });
      return true;
    }

    if (parts[1] && !parts[2] && req.method === "GET") {
      send(res, 200, database.getAll(parts[1]));
      return true;
    }

    if (parts[1] && !parts[2] && req.method === "PUT") {
      send(res, 200, database.putOne(parts[1], await readJson(req)));
      return true;
    }

    if (parts[1] && parts[2] && !parts[3] && req.method === "GET") {
      const row = database.getOne(parts[1], parts[2]);
      if (!row) {
        send(res, 404, { error: "Not found" });
        return true;
      }
      send(res, 200, row);
      return true;
    }

    if (parts[1] && parts[2] && !parts[3] && req.method === "DELETE") {
      database.delOne(parts[1], parts[2]);
      res.writeHead(204);
      res.end();
      return true;
    }

    send(res, 404, { error: "Not found" });
    }, session.user.id);
    return true;
  } catch (error) {
    if (res.headersSent) return true;
    send(res, error.status || 400, { error: error.message || "Bad request" });
    return true;
  }
}

function clearBridgeFile() {
  const file = path.join(database.getDataDir(), "life-os-bridge.json");
  try { fs.unlinkSync(file); } catch { /* already gone */ }
}

function serveStatic(distDir, req, res) {
  const url = new URL(req.url || "/", `http://${HOST}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("\0")) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const root = path.resolve(distDir);
  let filePath = path.resolve(root, `.${pathname}`);
  if (pathname.endsWith("/")) filePath = path.join(filePath, "index.html");
  const inside = filePath === root || filePath.startsWith(root + path.sep);
  if (!inside) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(root, "index.html"), (err2, html) => {
        if (err2) {
          res.writeHead(500);
          res.end("Internal error");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function main() {
  const isDev = process.argv.includes("--dev");
  const root = path.join(__dirname, "..");
  database.initDatabase();
  clearBridgeFile();

  let vite = null;
  if (isDev) {
    const { createServer } = await import("vite");
    vite = await createServer({
      root,
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  const distDir = path.join(root, "dist");
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}`);
    if (await handleApi(req, res, url)) return;
    if (vite) {
      vite.middlewares(req, res);
      return;
    }
    serveStatic(distDir, req, res);
  });

  await new Promise((resolve, reject) => {
    server.listen(PORT, HOST, resolve);
    server.on("error", reject);
  });

  const actualPort = server.address().port;
  console.log(`[server] Listening on http://${HOST}:${actualPort}`);

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
