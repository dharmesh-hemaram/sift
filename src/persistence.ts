import { createPipelineStore } from "./lib/storage.ts";
import type { PipelineStore } from "./types.ts";

// null outside a real extension context (the local preview server, or a
// build missing the "storage" permission) — every caller checks for that.
export const pipelineStore: PipelineStore | null =
  typeof chrome !== "undefined" && chrome.storage?.local ? createPipelineStore(chrome.storage.local) : null;
