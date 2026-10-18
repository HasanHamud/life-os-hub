const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const database = require("./database");

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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: "hiddenInset",
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  mainWindow.loadURL(devUrl || `http://127.0.0.1:${port}`);

  mainWindow.webContents.openDevTools();
}
function hashPin(pin) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}
function registerIpcHandlers() {
  ipcMain.handle("db:getAll", (_e, store) => database.getAll(store));
  ipcMain.handle("db:getOne", (_e, store, id) => database.getOne(store, id));
  ipcMain.handle("db:putOne", (_e, store, value) => database.putOne(store, value));
  ipcMain.handle("db:delOne", (_e, store, id) => database.delOne(store, id));
  ipcMain.handle("db:clearAll", () => database.clearAll());
  ipcMain.handle("db:exportAll", () => database.exportAll());
  ipcMain.handle("db:importAll", (_e, data) => database.importAll(data));
  ipcMain.handle("pin:getHash", () => database.getConfig("pinHash"));
  ipcMain.handle("pin:setHash", (_e, hash) => database.setConfig("pinHash", hash));
  ipcMain.handle("pin:exists", () => database.getConfig("pinHash") !== null);
  ipcMain.handle("pin:set", (_e, pin) => {
    database.setConfig("pinHash", hashPin(pin));
    return true;
  });
  ipcMain.handle("pin:verify", (_e, pin) => {
    const stored = database.getConfig("pinHash");
    if (!stored) return true;
    return hashPin(pin) === stored;
  });
}
app.whenReady().then(() => {
  database.initDatabase();
  registerIpcHandlers();

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
app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
