// Copies everything tsc/sass don't produce (manifest, html, icons) into
// dist/ alongside the compiled JS/CSS, so dist/ is a complete, loadable
// unpacked-extension directory.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

const assets = ["manifest.json", "devtools.html", "panel.html", "sandbox.html", "icons"];

// fixtures/ (static JSONPlaceholder sample data for local testing, see
// panel.ts) only ships with `npm run dev` — never in the real extension
// build. Always clean it up first so a stray `npm run build` after a
// `npm run dev` doesn't leave it behind.
const isDev = process.argv.includes("--dev");
if (isDev) assets.push("fixtures");
rmSync(path.join(distDir, "fixtures"), { recursive: true, force: true });

// cpSync merges rather than mirrors — without this, a file removed from
// src/icons/ would silently linger in dist/icons/ across rebuilds.
for (const asset of assets) rmSync(path.join(distDir, asset), { recursive: true, force: true });

mkdirSync(distDir, { recursive: true });
for (const asset of assets) {
  cpSync(path.join(srcDir, asset), path.join(distDir, asset), { recursive: true });
}
console.log(`Copied ${assets.join(", ")} to dist/`);
