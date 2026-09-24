// Mutations that touch shared state and need a persist/re-render afterward
// — the "controller" layer between UI event handlers and state.ts. UI
// modules call these instead of mutating `state` directly for anything with
// a side effect (persistence, debouncing); simple presentation-only state
// (like which result tab is active) is still set directly by the UI module
// that owns it.
import { state, selectedEntry } from "./state.ts";
import { scheduleRender, scheduleMainRender } from "./renderBus.ts";
import { pipelineStore } from "./persistence.ts";
import type { CapturedResponse, PipelineStep } from "./types.ts";

interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  flush(): void;
}

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;
  function wrapped(...args: Args): void {
    pendingArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const args2 = pendingArgs!;
      pendingArgs = null;
      fn(...args2);
    }, ms);
  }
  wrapped.flush = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    if (args) fn(...args);
  };
  return wrapped as Debounced<Args>;
}

export const persistPipeline = debounce(async (urlPattern: string, steps: PipelineStep[]) => {
  if (pipelineStore) await pipelineStore.save(urlPattern, steps);
}, 300);

export async function selectResponse(entry: CapturedResponse): Promise<void> {
  persistPipeline.flush(); // don't lose an in-flight edit on the response we're leaving
  state.selectedId = entry.id;
  state.resultViewMode = "table";
  state.importError = null;
  state.viewMode = "single";
  state.pipelineSteps = (pipelineStore && (await pipelineStore.load(entry.urlPattern))?.steps) || [];
  scheduleRender();
}

export function clearAll(): void {
  state.capturedResponses.length = 0;
  state.selectedId = null;
  state.pipelineSteps = [];
  state.combineInputs = [
    { responseId: null, key: "" },
    { responseId: null, key: "" },
  ];
  scheduleRender();
}

// Shared toggle logic for the rail's "mode" buttons (Combine, Manage) —
// clicking the active one goes back to the single-response view, clicking
// the other one switches to it.
function setViewMode(mode: "combine" | "manage"): void {
  state.viewMode = state.viewMode === mode ? "single" : mode;
  scheduleRender();
}

export function toggleCombineMode(): void {
  setViewMode("combine");
}

export function toggleManageMode(): void {
  setViewMode("manage");
}

export function updatePipeline(mutate: (steps: PipelineStep[]) => PipelineStep[]): void {
  state.pipelineSteps = mutate(state.pipelineSteps);
  const entry = selectedEntry();
  if (entry) persistPipeline(entry.urlPattern, state.pipelineSteps);
  scheduleMainRender();
}
