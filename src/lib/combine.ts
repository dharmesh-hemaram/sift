// SPEC.md §2 — multi-response combine. Phase 6 (PLAN.md), built with
// Dharmesh's explicit sign-off on the *interim* approach only: a plain,
// boring dropdown-based input picker, no visual connector/wire diagram.
import { getByPath } from "./ops.ts";
import type { CombineEntry, CombineOperationDef, CombineOpId } from "../types.ts";

type Row = Record<string, unknown>;

export function concat(arrays: unknown[][]): unknown[] {
  return arrays.flatMap((a) => (Array.isArray(a) ? a : [a]));
}

export function mergeByIndex(arrays: Row[][]): Row[] {
  const lists = arrays.map((a) => (Array.isArray(a) ? a : []));
  const len = lists.length ? Math.max(...lists.map((a) => a.length)) : 0;
  const result: Row[] = [];
  for (let i = 0; i < len; i++) {
    result.push(Object.assign({}, ...lists.map((a) => a[i] ?? {})));
  }
  return result;
}

// entries: [{ data, key }, { data, key, fieldName }, ...] — at least 2.
// entries[0] is the "one" side (e.g. users); every entry after it is a
// "many" side (e.g. posts) nested into an array field on each entries[0]
// row, matched by entries[0].key === entries[i].key on that row.
//
// This used to flatten into one row per matching PAIR (a classic SQL-style
// equi-join), which duplicates every "one"-side field once per match on the
// "many" side — surprising for the devtools use case this exists for
// (users+posts should read as one row per user with their posts attached,
// not N duplicated user rows). A "one" row with no matches is still kept,
// just with an empty array, rather than dropped — Diff/Intersect already
// cover "only rows with/without a match" if that's what's wanted.
export function joinByKey(entries: CombineEntry[]): Row[] {
  if (entries.length < 2) throw new Error("Join by key needs at least 2 inputs");
  const base = entries[0]!;
  let result: Row[] = (base.data as Row[]).map((row) => ({ ...row }));

  for (let i = 1; i < entries.length; i++) {
    const child = entries[i]!;
    const grouped = new Map<unknown, Row[]>();
    for (const row of child.data as Row[]) {
      const k = getByPath(row, child.key);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(row);
    }
    const fieldName = child.fieldName || `input${i + 1}`;
    result = result.map((row) => ({
      ...row,
      [fieldName]: grouped.get(getByPath(row, base.key)) ?? [],
    }));
  }

  return result;
}

// "Auto from URL pattern": the last non-`:id` path segment, so
// "/api/v2/accounts/:id" -> "accounts", "/posts" -> "posts". Falls back to
// "items" if every segment was collapsed to `:id` (or there are none).
export function fieldNameFromUrlPattern(urlPattern: string): string {
  const segments = String(urlPattern).split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i] !== ":id") return segments[i]!;
  }
  return "items";
}

// Diff/Intersect are explicitly capped at 2 inputs (SPEC.md §2 — N-way diff
// is a Venn-diagram problem, not a single filter; don't generalize it).
export function diffByKey(a: Row[], aKey: string, b: Row[], bKey: string): Row[] {
  const bKeys = new Set(b.map((row) => getByPath(row, bKey)));
  return a.filter((row) => !bKeys.has(getByPath(row, aKey)));
}

export function intersectByKey(a: Row[], aKey: string, b: Row[], bKey: string): Row[] {
  const bKeys = new Set(b.map((row) => getByPath(row, bKey)));
  return a.filter((row) => bKeys.has(getByPath(row, aKey)));
}

export const COMBINE_OPERATIONS: readonly CombineOperationDef[] = [
  { id: "concat", label: "Concat", minInputs: 2, maxInputs: Infinity, needsKey: false },
  { id: "mergeByIndex", label: "Merge by index", minInputs: 2, maxInputs: Infinity, needsKey: false },
  { id: "join", label: "Join by key", minInputs: 2, maxInputs: Infinity, needsKey: true },
  { id: "diff", label: "Diff", minInputs: 2, maxInputs: 2, needsKey: true },
  { id: "intersect", label: "Intersect", minInputs: 2, maxInputs: 2, needsKey: true },
];

export const COMBINE_OPERATIONS_BY_ID: Record<CombineOpId, CombineOperationDef> = Object.fromEntries(
  COMBINE_OPERATIONS.map((d) => [d.id, d]),
) as Record<CombineOpId, CombineOperationDef>;

// inputs: [{ data, key }, ...]. `key` is ignored for ops that don't need one.
export function runCombine(operation: string, inputs: CombineEntry[]): unknown {
  const def = COMBINE_OPERATIONS_BY_ID[operation as CombineOpId];
  if (!def) throw new Error(`Unknown combine operation "${operation}"`);
  if (inputs.length < def.minInputs) throw new Error(`${def.label} needs at least ${def.minInputs} inputs`);
  if (inputs.length > def.maxInputs) throw new Error(`${def.label} is capped at ${def.maxInputs} inputs`);
  if (def.needsKey && inputs.some((i) => !i.key)) throw new Error(`${def.label} needs a key for every input`);

  const arrays = inputs.map((i) => i.data as Row[]);
  switch (def.id) {
    case "concat":
      return concat(arrays);
    case "mergeByIndex":
      return mergeByIndex(arrays);
    case "join":
      return joinByKey(inputs);
    case "diff":
      return diffByKey(inputs[0]!.data as Row[], inputs[0]!.key, inputs[1]!.data as Row[], inputs[1]!.key);
    case "intersect":
      return intersectByKey(inputs[0]!.data as Row[], inputs[0]!.key, inputs[1]!.data as Row[], inputs[1]!.key);
  }
}
