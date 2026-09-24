import * as ops from "./ops.ts";
import type { OpDefinition, PipelineStep, PipelineHandlers, StepResult, PipelineRunResult } from "../types.ts";

// Metadata drives the generic "add step" UI in the panel — each op declares
// its param shape instead of hand-rolling a form per op.
export const OP_DEFINITIONS: readonly OpDefinition[] = [
  // --- array of objects ---
  {
    id: "extract",
    label: "Extract field(s)",
    category: "array",
    params: [{ name: "keys", type: "keys", label: "Fields" }],
  },
  {
    id: "filter",
    label: "Filter",
    category: "array",
    params: [{ name: "conditions", type: "conditions", label: "Conditions" }],
  },
  {
    id: "sort",
    label: "Sort",
    category: "array",
    params: [
      { name: "key", type: "key", label: "Field" },
      { name: "direction", type: "select", label: "Direction", options: ["asc", "desc"], default: "asc" },
    ],
  },
  { id: "groupBy", label: "Group by field", category: "array", params: [{ name: "key", type: "key", label: "Field" }] },
  { id: "countBy", label: "Count by field", category: "array", params: [{ name: "key", type: "key", label: "Field" }] },
  { id: "unique", label: "Unique values", category: "array", params: [{ name: "key", type: "key", label: "Field" }] },
  {
    id: "duplicates",
    label: "Find duplicates",
    category: "array",
    params: [{ name: "key", type: "key", label: "Field" }],
  },
  {
    id: "aggregate",
    label: "Aggregate",
    category: "array",
    params: [
      { name: "key", type: "key", label: "Field" },
      { name: "fn", type: "select", label: "Function", options: ops.AGGREGATE_FNS, default: "sum" },
    ],
  },
  {
    id: "slice",
    label: "Slice first/last N",
    category: "array",
    params: [
      { name: "n", type: "number", label: "N", default: 10 },
      { name: "from", type: "select", label: "From", options: ["first", "last"], default: "first" },
    ],
  },
  {
    id: "deepSearch",
    label: "Deep search",
    category: "array",
    params: [{ name: "text", type: "text", label: "Search text" }],
  },
  {
    id: "flattenArray",
    label: "Flatten nested array",
    category: "array",
    params: [{ name: "key", type: "key", label: "Field" }],
  },
  { id: "toCSV", label: "Convert to CSV", category: "array", params: [] },
  {
    id: "toDictionary",
    label: "Convert to dictionary",
    category: "array",
    params: [{ name: "key", type: "key", label: "Key field" }],
  },

  // --- single object ---
  { id: "pick", label: "Pick keys", category: "object", params: [{ name: "keys", type: "keys", label: "Fields" }] },
  { id: "omit", label: "Omit keys", category: "object", params: [{ name: "keys", type: "keys", label: "Fields" }] },
  { id: "flattenObject", label: "Flatten nested object", category: "object", params: [] },
  {
    id: "getByPath",
    label: "Get by path",
    category: "object",
    params: [{ name: "path", type: "text", label: "Dot path" }],
  },
  { id: "listKeys", label: "List all keys (deep)", category: "object", params: [] },

  // --- escape hatch (SPEC.md §2 — always present) ---
  {
    id: "custom",
    label: "Custom expression…",
    category: "custom",
    params: [{ name: "code", type: "code", label: "Expression" }],
  },
];

export const OP_DEFINITIONS_BY_ID: Record<string, OpDefinition> = Object.fromEntries(
  OP_DEFINITIONS.map((d) => [d.id, d]),
);

const DEFAULT_HANDLERS: PipelineHandlers = {
  extract: (data, s) => ops.extractFields(data as never, s.keys ?? []),
  filter: (data, s) => ops.filterRows(data as never, s.conditions ?? []),
  sort: (data, s) => ops.sortRows(data as never, s.key, s.direction),
  groupBy: (data, s) => ops.groupBy(data as never, s.key),
  countBy: (data, s) => ops.countBy(data as never, s.key),
  unique: (data, s) => ops.uniqueValues(data as never, s.key),
  duplicates: (data, s) => ops.findDuplicates(data as never, s.key),
  aggregate: (data, s) => ops.aggregate(data as never, s.key, s.fn),
  slice: (data, s) => ops.sliceRows(data as never, Number(s.n) || 0, s.from),
  deepSearch: (data, s) => ops.deepSearch(data, s.text),
  flattenArray: (data, s) => ops.flattenByKey(data as never, s.key),
  toCSV: (data) => ops.toCSV(data as never),
  toDictionary: (data, s) => ops.toDictionary(data as never, s.key),
  pick: (data, s) => ops.pickKeys(data as never, s.keys ?? []),
  omit: (data, s) => ops.omitKeys(data as never, s.keys ?? []),
  flattenObject: (data) => ops.flattenObject(data as never),
  getByPath: (data, s) => ops.getByPath(data, s.path),
  listKeys: (data) => ops.listKeysDeep(data),
  custom: (data, s) => ops.runCustomExpression(data, s.code ?? ""),
};

// Runs steps in order against initialData. Stops at the first step that
// throws (or whose required key isn't present in its input) and marks that
// step broken, per SPEC.md §5's "broken/unmatched" handling — the pipeline
// still returns the last good result rather than silently going empty.
//
// `handlerOverrides` lets a caller swap out individual op handlers without
// touching this module — panel.js uses it to run "custom" (SPEC.md §2's
// `new Function` escape hatch) inside a sandboxed extension page instead of
// directly, since Manifest V3's page CSP blocks `new Function` everywhere
// else. The default `custom` handler (used here and by every test in this
// file) evaluates directly, which is fine outside a browser extension page.
// Async so a handler override may itself be async (e.g. postMessage to a
// sandboxed iframe) without special-casing any one op.
export async function runPipeline(
  initialData: unknown,
  steps: PipelineStep[],
  handlerOverrides: PipelineHandlers = {},
): Promise<PipelineRunResult> {
  const handlers: PipelineHandlers = { ...DEFAULT_HANDLERS, ...handlerOverrides };
  let current: unknown = initialData;
  const stepResults: StepResult[] = [];
  let stopped = false;

  for (const step of steps) {
    if (stopped) {
      stepResults.push({ step, error: null, broken: false, skipped: true });
      continue;
    }
    const handler = handlers[step.op];
    if (!handler) {
      stepResults.push({ step, error: `Unknown operation "${step.op}"`, broken: true });
      stopped = true;
      continue;
    }
    try {
      current = await handler(current, step);
      stepResults.push({ step, error: null, broken: false });
    } catch (err) {
      stepResults.push({ step, error: (err as Error).message, broken: true });
      stopped = true;
    }
  }

  return { result: current, stepResults };
}

// Best-effort key list for a given value, used to populate the "field"
// suggestions in the add-step UI as the pipeline's intermediate shape
// changes step to step.
export function detectKeys(data: unknown): string[] {
  if (Array.isArray(data)) {
    const first = data.find((item) => item !== null && typeof item === "object");
    return first ? Object.keys(first) : [];
  }
  if (data !== null && typeof data === "object") return Object.keys(data);
  return [];
}
