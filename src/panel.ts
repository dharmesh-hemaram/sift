// Composition root: wires capture, initial DOM listeners, and the first
// render. Everything else lives in its own module — state.ts owns data,
// actions.ts owns mutations, render.ts + ui/*.ts own the DOM, lib/*.ts owns
// pure logic. See PLAN.md / SPEC.md for the feature-level phase history.
import { captureResponse, hasDevToolsHost } from "./capture.ts";
import { initRail } from "./ui/rail.ts";
import { render } from "./render.ts";

initRail();
render();

// No real DevTools host (panel.html opened directly, not inside a real
// DevTools window) — try loading static JSONPlaceholder sample data instead
// of sitting empty. fixtures/jsonplaceholder.json only exists after
// `npm run dev` (see scripts/copy-assets.mjs) — `npm run build`, the real
// extension build, never ships it, so this 404s harmlessly there, and e2e
// tests (which build with `npm run build`) are unaffected.
if (!hasDevToolsHost) {
  fetch("fixtures/jsonplaceholder.json")
    .then((res) => (res.ok ? res.json() : undefined))
    .then((endpoints: Record<string, unknown> | undefined) => {
      for (const [name, body] of Object.entries(endpoints ?? {})) {
        captureResponse(`https://jsonplaceholder.typicode.com/${name}`, JSON.stringify(body));
      }
    })
    .catch(() => {
      // Fixtures are a dev convenience only — fine if the file is missing.
    });
}
