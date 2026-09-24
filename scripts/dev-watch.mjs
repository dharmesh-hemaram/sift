// `npm run dev`: one command that builds once, then watches for changes and
// rebuilds automatically. No bundler, no nodemon/chokidar dependency — just
// tsc's and sass's own --watch flags, plus Node's built-in fs.watch for the
// static assets (html/manifest/icons/fixtures) that aren't compiled at all.
import { spawn } from "node:child_process";
import { watch, cpSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, openBrowser } from "./dev-server.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT) || 4174;

const STATIC_ASSETS = ["manifest.json", "devtools.html", "panel.html", "sandbox.html", "icons", "fixtures"];

function copyStaticAssets() {
  for (const asset of STATIC_ASSETS) rmSync(path.join(distDir, asset), { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  for (const asset of STATIC_ASSETS) {
    cpSync(path.join(srcDir, asset), path.join(distDir, asset), { recursive: true });
  }
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function spawnWatcher(command, args, label) {
  // Single command STRING (not command + args array) is the documented safe
  // form for shell: true — Node warns/deprecates the array form since those
  // args aren't individually escaped. shell: true itself is what finds
  // tsc/sass via node_modules/.bin on every platform, including Windows,
  // without hardcoding a binary extension.
  const child = spawn([command, ...args].join(" "), { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code) console.error(`[${label}] exited with code ${code}`);
  });
  return child;
}

// --- initial build ---
copyStaticAssets();

let version = 0;
const bump = () => version++;

const tsc = spawnWatcher("tsc", ["--watch", "--preserveWatchOutput"], "tsc");
const sassWatch = spawnWatcher("sass", ["--watch", "src/panel.scss:dist/panel.css", "--no-source-map"], "sass");

// tsc and sass both write straight into dist/ — watching dist/ itself
// (rather than trying to correlate with each child process's own output)
// catches every rebuild uniformly, however it happened.
watch(distDir, { recursive: true }, debounce(bump, 150));

// Static assets aren't compiled, so they need their own watch + copy step.
// Skips .ts/.scss changes under src/ — tsc/sass already handle those.
watch(
  srcDir,
  { recursive: true },
  debounce((_event, filename) => {
    if (!filename || filename.endsWith(".ts") || filename.endsWith(".scss")) return;
    copyStaticAssets();
  }, 150),
);

const server = createServer({ getVersion: () => version });
server.listen(port, () => {
  const url = `http://localhost:${port}/panel.html`;
  console.log(`Sift dev server watching for changes — ${url} (Ctrl+C to stop)`);
  openBrowser(url);
});

function shutdown() {
  tsc.kill();
  sassWatch.kill();
  server.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
