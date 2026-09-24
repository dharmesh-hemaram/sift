// Phase 0 (PLAN.md): capture every JSON response DevTools sees.
import { normalizeUrlPattern } from "./lib/urlPattern.ts";
import { state } from "./state.ts";
import { scheduleRender } from "./renderBus.ts";
import type { DevToolsRequestLike } from "./types.ts";

let nextId = 1;

function handleRequestFinished(request: DevToolsRequestLike): void {
  const mimeType = request.response?.content?.mimeType ?? "";
  const looksJson = mimeType.includes("json");

  request.getContent((content) => {
    if (!content) return;
    try {
      JSON.parse(content);
    } catch {
      if (looksJson) return; // Content-Type said JSON but body wasn't parseable.
      return; // Not JSON at all — ignored for v1 (SPEC.md §1).
    }

    state.capturedResponses.push({
      id: nextId++,
      url: request.request.url,
      urlPattern: normalizeUrlPattern(request.request.url),
      status: request.response.status,
      size: content.length,
      time: new Date().toISOString(),
      content,
    });

    scheduleRender();
  });
}

// chrome.devtools.network is only available when this page is hosted by a
// real, open DevTools window. When it's missing (e.g. panel.html opened
// directly, as Playwright e2e tests do — there is no way to script the
// actual DevTools UI itself, see test/e2e/README.md) we expose the same
// handler as a test hook instead of crashing, so the real capture/render
// code path still runs end to end in a real browser.
const networkSource = typeof chrome !== "undefined" ? chrome.devtools?.network : undefined;

if (networkSource) {
  networkSource.onRequestFinished.addListener(handleRequestFinished as never);
} else {
  window.__sift = { handleRequestFinished };
}
