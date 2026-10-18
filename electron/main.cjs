const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const crypto = require("crypto");

const http = require("http");
const fs = require("fs");
const database = require("./database.cjs");
const bridgeCommands = require("./bridge-commands.cjs");

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let mainWindow;
let server;
let bridgeServer;
let bridgeFile;

function startServer(distDir, port) {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      let filePath = path.join(distDir, req.url === "/" ? "index.html" : req.url);
      const ext = path.extname(filePath);
      const contentType = MIME[ext] || "application/octet-stream";
      const headers = {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      };

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback: serve index.html for any non-file route
          fs.readFile(path.join(distDir, "index.html"), (err2, data2) => {
            if (err2) {
              res.writeHead(500);
              res.end("Internal error");
              return;
            }
            headers["Content-Type"] = "text/html";
            res.writeHead(200, headers);
            res.end(data2);
          });
          return;
        }
        res.writeHead(200, headers);
        res.end(data);
      });
    });

    server.listen(port, "127.0.0.1", () => {
      const actualPort = server.address().port;
      console.log(`[server] Listening on http://127.0.0.1:${actualPort}`);
      resolve(actualPort);
    });
    server.on("error", reject);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  mainWindow.loadURL(devUrl || `http://127.0.0.1:${port}`);

  if (devUrl) {
    mainWindow.webContents.openDevTools();
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
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

function tokenMatches(header, token) {
  const given = Buffer.from(String(header || ""));
  const expected = Buffer.from(token);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

function notifyChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bridge:changed");
  }
}

function startBridge() {
  const token = crypto.randomBytes(24).toString("hex");
  const userData = app.getPath("userData");
  bridgeFile = path.join(userData, "life-os-bridge.json");
  const dbPath = path.join(userData, "life-os.db");

  bridgeServer = http.createServer(async (req, res) => {
    const send = (status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      });
      res.end(body);
    };

    if (req.method !== "POST" || req.url !== "/command") {
      send(404, { ok: false, error: "Not found" });
      return;
    }
    if (!tokenMatches(req.headers["x-life-os-token"], token)) {
      send(401, { ok: false, error: "Unauthorized" });
      return;
    }

    try {
      const raw = await readRequestBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const { action, ...body } = payload;
      const result = bridgeCommands.handle(action, body);
      if (result.changed) notifyChanged();
      send(200, result);
    } catch (error) {
      send(400, { ok: false, error: error.message || "Bad request" });
    }
  });

  bridgeServer.listen(0, "127.0.0.1", () => {
    const port = bridgeServer.address().port;
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(bridgeFile, JSON.stringify({ port, token, dbPath }, null, 2));
    console.log(`[bridge] Listening on http://127.0.0.1:${port}`);
  });
}

function stopBridge() {
  if (bridgeServer) {
    bridgeServer.close();
    bridgeServer = null;
  }
  if (bridgeFile) {
    try { fs.unlinkSync(bridgeFile); } catch {}
    bridgeFile = null;
  }
}

function registerIpcHandlers() {
  ipcMain.handle("db:getAll", (_e, store) => database.getAll(store));
  ipcMain.handle("db:getOne", (_e, store, id) => database.getOne(store, id));
  ipcMain.handle("db:putOne", (_e, store, value) => database.putOne(store, value));
  ipcMain.handle("db:delOne", (_e, store, id) => database.delOne(store, id));
  ipcMain.handle("db:clearAll", () => database.clearAll());
  ipcMain.handle("db:clearStore", (_e, store) => database.clearStore(store));
  ipcMain.handle("db:exportAll", () => database.exportAll());
  ipcMain.handle("db:importAll", (_e, data) => database.importAll(data));
}

app.whenReady().then(async () => {
  database.initDatabase();
  registerIpcHandlers();
  startBridge();

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    createWindow(-1);
  } else {
    const distDir = path.join(__dirname, "..", "dist");
    const port = await startServer(distDir, 0).catch(() => startServer(distDir, 9292));
    createWindow(port);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  stopBridge();
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
