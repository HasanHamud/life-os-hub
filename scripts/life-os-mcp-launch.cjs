const { spawn } = require("child_process");
const path = require("path");

const electronPath = require("electron");
const child = spawn(electronPath, [path.join(__dirname, "life-os-mcp.cjs")], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => process.exit(code == null ? 1 : code));
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
