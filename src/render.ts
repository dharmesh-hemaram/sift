// The top-level render loop: rebuilds the rail, then (async, since custom-
// expression steps may hit the sandboxed iframe) rebuilds `#main`. A token
// guards against two renders triggered close together clobbering each
// other's DOM writes — see the comment on renderMain below.
import { main } from "./dom.ts";
import { state, selectedEntry, parsedData } from "./state.ts";
import { setRender, setMainRender } from "./renderBus.ts";
import { renderRail } from "./ui/rail.ts";
import { renderCombineView } from "./ui/combineView.ts";
import { renderSingleResponseView } from "./ui/pipelineView.ts";

function buildEmptyState(text: string): HTMLElement {
  const empty = document.createElement("div");
  empty.id = "empty-state";
  empty.textContent = text;
  return empty;
}

let renderToken = 0;

// Every DOM node for `#main` is built off-tree first; `main` itself is only
// touched once, at the end, behind the token check — otherwise two renders
// triggered close together (e.g. two quick edits) could each clear `main`
// mid-await and interleave, leaving duplicated or stale nodes in the live
// DOM.
async function renderMain(): Promise<void> {
  const token = ++renderToken;

  if (state.viewMode === "combine") {
    const view = renderCombineView();
    if (token !== renderToken) return;
    main.replaceChildren(view);
    return;
  }

  const entry = selectedEntry();

  if (!entry) {
    if (token !== renderToken) return;
    main.replaceChildren(
      buildEmptyState(
        state.capturedResponses.length
          ? "Select a captured response on the left to view it."
          : "Reload the inspected page — captured JSON responses will appear on the left.",
      ),
    );
    return;
  }

  const data = parsedData(entry);
  if (data === undefined) {
    if (token !== renderToken) return;
    main.replaceChildren(buildEmptyState("Couldn't parse this response as JSON."));
    return;
  }

  const children = await renderSingleResponseView(entry, data);
  if (token !== renderToken) return; // superseded by a newer render — discard
  main.replaceChildren(...children);
}

export function render(): void {
  renderRail();
  void renderMain();
}

setRender(render);
setMainRender(() => void renderMain());
