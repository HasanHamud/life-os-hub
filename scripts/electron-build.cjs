const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(os.tmpdir(), "life-os-hub-release");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const builder = path.join(root, "node_modules", "electron-builder", "cli.js");
const result = spawnSync(process.execPath, [builder, `--config.directories.output=${out}`], {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const release = path.join(root, "release");
fs.mkdirSync(release, { recursive: true });
const copied = [];
for (const name of fs.readdirSync(out)) {
  const src = path.join(out, name);
  if (!fs.statSync(src).isFile()) continue;
  const dest = path.join(release, name);
  try {
    fs.copyFileSync(src, dest);
    copied.push(dest);
  } catch (error) {
    console.log(`Could not copy ${name} into release\\ (${error.message})`);
    console.log(`The built file is here: ${src}`);
  }
}

console.log("\nInstaller files:");
for (const file of copied) console.log(file);
