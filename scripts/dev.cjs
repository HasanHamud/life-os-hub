const { spawn, execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

// Find electron binary
let electronPath;
try {
  electronPath = require("electron");
} catch {
  try {
    electronPath = path.join(root, "node_modules", ".bin", "electron.cmd");
  } catch {
    console.error("Electron not found. Run npm install first.");
    process.exit(1);
  }
}

console.log("Starting Vite dev server...");

const viteCmd = path.join(root, "node_modules", ".bin", "vite.cmd");
const vite = spawn("cmd.exe", ["/c", viteCmd], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, VITE_NO_CONSOLE_NINJA: "1" },
});

let viteUrl = null;

function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

vite.stdout.on("data", (data) => {
  const text = data.toString();
  process.stdout.write(text);

  if (!viteUrl) {
    const plain = stripAnsi(text);
    const match = plain.match(/Local:\s+(https?:\/\/[^\s]+)/);
    if (match) {
      viteUrl = match[1].replace(/\/$/, "");
      console.log(`\n[dev] Vite URL detected: ${viteUrl}`);
      startElectron();
    }
  }
});

vite.stderr.on("data", (data) => {
  process.stderr.write(data.toString());
});

vite.on("error", (err) => {
  console.error("Failed to start Vite:", err.message);
  process.exit(1);
});

function startElectron() {
  const electronMain = path.join(root, "electron", "main.cjs");
  console.log(`[dev] Starting Electron → ${viteUrl}\n`);

  const electron = spawn("cmd.exe", ["/c", electronPath, electronMain], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: viteUrl },
  });

  electron.on("error", (err) => {
    console.error("Failed to start Electron:", err.message);
  });

  electron.on("close", (code) => {
    console.log(`\nElectron exited with code ${code}`);
    vite.kill();
    process.exit();
  });
}

process.on("SIGINT", () => {
  vite.kill();
  process.exit();
});

process.on("SIGTERM", () => {
  vite.kill();
  process.exit();
});
