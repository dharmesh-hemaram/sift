// Copies everything tsc/sass don't produce (manifest, html, icons) into
// dist/ alongside the compiled JS/CSS, so dist/ is a complete, loadable
// unpacked-extension directory.
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

const assets = ["manifest.json", "devtools.html", "panel.html", "sandbox.html", "icons"];

mkdirSync(distDir, { recursive: true });
for (const asset of assets) {
  cpSync(path.join(srcDir, asset), path.join(distDir, asset), { recursive: true });
}
console.log(`Copied ${assets.join(", ")} to dist/`);
