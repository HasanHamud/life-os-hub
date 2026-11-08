# Life OS Hub

A local personal operating system: tasks, time, finance, learning, and notes. One Node process serves the API and the web app. Each computer keeps its own SQLite database. A new install starts empty.

## Prerequisites

On every computer that will run the app:

- **Node.js 20.19+ or 22.12+**, with npm (npm comes with the Node installer). [nodejs.org](https://nodejs.org/)
- A current desktop browser (Chrome, Edge, Firefox, or Safari).

`better-sqlite3` normally installs from a prebuilt binary. If `npm install` fails while building it, install a native toolchain and run `npm install` again:

- **Windows:** Visual Studio Build Tools with the “Desktop development with C++” workload, plus Python 3.
- **macOS:** Xcode Command Line Tools (`xcode-select --install`).
- **Linux:** `build-essential` and `python3`.

Git is optional. Copying the project folder works the same as cloning it.

Do not copy `node_modules` or `dist` to the other computer. Those folders are machine-specific. Run `npm install` (and `npm run build` for production) on the new machine.

## Install

From the project folder:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:9090](http://127.0.0.1:9090).

The first visit asks you to create an admin account: name, email, and a password of at least 8 characters. After that, sign in with that email and password. Nothing is shared with the computer you copied the project from.

## Run a built copy

Use this when you want the app without the Vite dev server:

```bash
npm run build
npm start
```

`npm start` serves the `dist/` folder. If you have not run `npm run build`, the page will not load.

Stop the server with Ctrl+C.

## Share it with another computer

1. Install Node.js (see Prerequisites).
2. Copy the project folder, or clone the repo. Leave out `node_modules` and `dist`.
3. On the new computer, run `npm install`, then `npm run dev` (or `npm run build` and `npm start`).
4. Open [http://127.0.0.1:9090](http://127.0.0.1:9090) and create a new admin account.

The database is created automatically on first start. Default location:

| System | Path |
| --- | --- |
| Windows | `%APPDATA%\life-os-hub\life-os.db` |
| macOS | `~/Library/Application Support/life-os-hub/life-os.db` |
| Linux | `~/.config/life-os-hub/life-os.db` |

## Optional environment variables

Set these in the shell before `npm run dev` or `npm start`.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `9090` | Port the server listens on |
| `LIFE_OS_HOST` | `127.0.0.1` | Bind address. `127.0.0.1` is this computer only |
| `LIFE_OS_DB` | see table above | Full path to the SQLite file |

PowerShell:

```powershell
$env:PORT = "9090"
npm run dev
```

bash:

```bash
PORT=9090 npm run dev
```

`LIFE_OS_HOST=0.0.0.0` lets other devices on the same network open the app. The server has no HTTPS. Leave the default if you only use it on that computer.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with live reload on port 9090 |
| `npm start` | Serve the built app from `dist/` |
| `npm run build` | Build the web app into `dist/` |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the repo with Prettier |
