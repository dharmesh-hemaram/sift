// Manifest V3's default extension-page CSP forbids 'unsafe-eval', so
// `new Function` (used by the custom-expression escape hatch, SPEC.md §2)
// can't run in panel.html directly. A `sandbox` page (declared in
// manifest.json) is Chrome's sanctioned way around that: it gets a relaxed
// CSP in exchange for losing all chrome.* API access, so it can only ever
// touch the data panel.js explicitly posts to it — nothing else in the
// extension is reachable from here. Communication is postMessage only,
// entirely within the browser (no network call, per CLAUDE.md hard rule #2).
import { runCustomExpression } from "./lib/ops.js";

window.addEventListener("message", (event) => {
  const { id, data, code } = event.data ?? {};
  if (id === undefined) return;
  try {
    const result = runCustomExpression(data, code);
    event.source.postMessage({ id, result }, "*");
  } catch (err) {
    event.source.postMessage({ id, error: err.message }, "*");
  }
});
