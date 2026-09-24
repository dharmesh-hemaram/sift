// The app's single mutable state object. Every module reads/writes through
// this shared reference rather than owning private copies — there's no
// framework here to diff/reconcile state, so one object as the single
// source of truth is what keeps every UI module honest about what it
// actually depends on.
import type { CapturedResponse, CombineInputState, CombineOpId, PipelineStep } from "./types.ts";

export interface AppState {
  capturedResponses: CapturedResponse[];
  selectedId: number | null;
  pipelineSteps: PipelineStep[];
  resultViewMode: "table" | "raw";
  includeSampleOnExport: boolean;
  importError: string | null;

  viewMode: "single" | "combine" | "manage"; // see PLAN.md Phase 6
  combineOperation: CombineOpId;
  combineInputs: CombineInputState[];
  combineResultViewMode: "table" | "raw";
}

export const state: AppState = {
  capturedResponses: [],
  selectedId: null,
  pipelineSteps: [],
  resultViewMode: "table",
  includeSampleOnExport: false,
  importError: null,

  viewMode: "single",
  combineOperation: "concat",
  combineInputs: [
    { responseId: null, key: "" },
    { responseId: null, key: "" },
  ],
  combineResultViewMode: "table",
};

export function selectedEntry(): CapturedResponse | null {
  return state.capturedResponses.find((r) => r.id === state.selectedId) ?? null;
}

// Captured response bodies are parsed lazily and memoized on the entry
// itself (`_parsed`) — most captures are never opened, so there's no reason
// to JSON.parse every response as it comes in.
export function parsedData(entry: CapturedResponse | null | undefined): unknown {
  if (!entry) return undefined;
  if (!("_parsed" in entry)) {
    try {
      entry._parsed = JSON.parse(entry.content);
    } catch {
      entry._parsed = undefined;
    }
  }
  return entry._parsed;
}
