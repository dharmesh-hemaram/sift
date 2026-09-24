// Phase 0 (PLAN.md): capture every JSON response DevTools sees.
import { normalizeUrlPattern } from "./lib/urlPattern.ts";
import { state } from "./state.ts";
import { scheduleRender } from "./renderBus.ts";
import type { DevToolsRequestLike } from "./types.ts";

let nextId = 1;

// Shared by the real chrome.devtools.network listener below and the manual
// dev-capture panel (ui/devCapture.ts) — same validation, same push. Returns
// false (and adds nothing) if `content` isn't valid JSON.
export function captureResponse(url: string, content: string, status = 200): boolean {
  if (!content) return false;
  try {
    JSON.parse(content);
  } catch {
    return false; // Not JSON, or malformed JSON — ignored for v1 (SPEC.md §1).
  }

  state.capturedResponses.push({
    id: nextId++,
    url,
    urlPattern: normalizeUrlPattern(url),
    status,
    size: content.length,
    time: new Date().toISOString(),
    content,
  });
  scheduleRender();
  return true;
}

function handleRequestFinished(request: DevToolsRequestLike): void {
  request.getContent((content) => {
    captureResponse(request.request.url, content, request.response.status);
  });
}

// chrome.devtools.network is only available when this page is hosted by a
// real, open DevTools window. When it's missing — panel.html opened
// directly for local testing (see README's Quick start), or Playwright e2e
// tests, since there's no way to script the actual DevTools UI itself, see
// test/e2e/README.md — we still want the rest of the app to work: expose
// the same handler as a test hook, and let ui/devCapture.ts show a manual
// "add a response" form instead of the panel just sitting empty forever.
export const hasDevToolsHost = typeof chrome !== "undefined" && Boolean(chrome.devtools?.network);

if (hasDevToolsHost) {
  chrome.devtools.network.onRequestFinished.addListener(handleRequestFinished as never);
} else {
  window.__sift = { handleRequestFinished };
}
