// Minimal static file server for local testing (no bundler-dev-server
// dependency). Exports createServer()/openBrowser() for reuse by
// dev-watch.mjs; also runnable standalone (`node scripts/dev-server.mjs`)
// against whatever's already in dist/, with no watching or auto-reload.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const distDir = path.join(rootDir, "dist");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Tiny polling auto-reload for local dev only — no websocket dependency,
// just checks an in-memory build counter once a second and reloads the tab
// when it changes. `getVersion` is bumped by dev-watch.mjs's file watchers.
function reloadSnippet(initialVersion) {
  return `
<script>
  (function () {
    var known = ${initialVersion};
    setInterval(function () {
      fetch('/__version').then(function (r) { return r.json(); }).then(function (data) {
        if (data.version !== known) location.reload();
      }).catch(function () {});
    }, 1000);
  })();
</script>`;
}

export function createServer({ getVersion = () => 0 } = {}) {
  return http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);

    if (urlPath === "/__version") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ version: getVersion() }));
      return;
    }

    const relative = urlPath === "/" ? "panel.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.join(distDir, relative);

    // Keep requests inside dist/ — no path traversal out of the served root.
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    try {
      let data = await readFile(filePath);
      const ext = path.extname(filePath);
      if (ext === ".html") {
        data = Buffer.from(data.toString("utf8").replace("</body>", `${reloadSnippet(getVersion())}</body>`));
      }
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
}

export function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`Couldn't auto-open a browser — visit ${url} manually.`);
  });
}

// Only self-start when run directly (`node scripts/dev-server.mjs`) —
// dev-watch.mjs imports createServer()/openBrowser() instead, so it can
// wire in a live build-version counter from its file watchers.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 4174;
  const server = createServer();
  server.listen(port, () => {
    const url = `http://localhost:${port}/panel.html`;
    console.log(`Sift dev preview running at ${url} (Ctrl+C to stop) — static, no watching`);
    openBrowser(url);
  });
}
