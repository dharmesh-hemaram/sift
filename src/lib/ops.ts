// SPEC.md §2 — the operations catalog. Every function here is pure (no DOM,
// no chrome.* APIs) so it can run identically in the panel and in tests.
import type { FilterCondition, FilterOperator } from "../types.ts";

type Row = Record<string, unknown>;

export function getByPath(obj: unknown, path: string | undefined | null): unknown {
  if (obj == null || path === "" || path == null) return obj;
  const parts = String(path).split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = (cur as Row)[part];
  }
  return cur;
}

export function pickKeys(obj: Row | null | undefined, keys: string[]): Row {
  const result: Row = {};
  for (const k of keys) {
    if (obj != null && Object.prototype.hasOwnProperty.call(obj, k)) {
      result[k] = obj[k];
    }
  }
  return result;
}

export function omitKeys(obj: Row | null | undefined, keys: string[]): Row {
  const drop = new Set(keys);
  const result: Row = {};
  for (const k of Object.keys(obj ?? {})) {
    if (!drop.has(k)) result[k] = (obj as Row)[k];
  }
  return result;
}

export function extractFields(arr: Row[], keys: string[]): Row[] {
  return arr.map((item) => pickKeys(item, keys));
}

const OPERATORS: Record<FilterOperator, (a: unknown, b: unknown) => boolean> = {
  "=": (a, b) => String(a) === String(b),
  "!=": (a, b) => String(a) !== String(b),
  ">": (a, b) => Number(a) > Number(b),
  "<": (a, b) => Number(a) < Number(b),
  contains: (a, b) =>
    String(a ?? "")
      .toLowerCase()
      .includes(String(b ?? "").toLowerCase()),
};

export const FILTER_OPERATORS = Object.keys(OPERATORS) as FilterOperator[];

function evalCondition(item: Row, { key, operator, value }: FilterCondition): boolean {
  const op = OPERATORS[operator];
  if (!op) throw new Error(`Unknown filter operator: ${operator}`);
  return op(getByPath(item, key), value);
}

// conditions: [{ key, operator, value, connector }] — connector ('AND'|'OR')
// joins this condition to the PREVIOUS one; the first condition's connector
// is ignored. SPEC.md §2 "supports multiple AND/OR rows".
export function filterRows(arr: Row[], conditions: FilterCondition[] | undefined): Row[] {
  if (!conditions || !conditions.length) return arr;
  return arr.filter((item) => {
    let result = evalCondition(item, conditions[0]!);
    for (let i = 1; i < conditions.length; i++) {
      const cond = conditions[i]!;
      const val = evalCondition(item, cond);
      result = cond.connector === "OR" ? result || val : result && val;
    }
    return result;
  });
}

export function sortRows(arr: Row[], key: string | undefined, direction: "asc" | "desc" = "asc"): Row[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...arr].sort((a, b) => {
    const av = getByPath(a, key) as never;
    const bv = getByPath(b, key) as never;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
}

export function groupBy(arr: Row[], key: string | undefined): Record<string, Row[]> {
  const result: Record<string, Row[]> = {};
  for (const item of arr) {
    const k = String(getByPath(item, key));
    (result[k] ??= []).push(item);
  }
  return result;
}

export function countBy(arr: Row[], key: string | undefined): Record<string, number> {
  const groups = groupBy(arr, key);
  const result: Record<string, number> = {};
  for (const k of Object.keys(groups)) result[k] = groups[k]!.length;
  return result;
}

export function uniqueValues(arr: Row[], key: string | undefined): unknown[] {
  return [...new Set(arr.map((item) => getByPath(item, key)))];
}

export function findDuplicates(arr: Row[], key: string | undefined): Record<string, Row[]> {
  const groups = groupBy(arr, key);
  const result: Record<string, Row[]> = {};
  for (const k of Object.keys(groups)) {
    if (groups[k]!.length > 1) result[k] = groups[k]!;
  }
  return result;
}

type AggregateFn = "sum" | "avg" | "min" | "max";

const AGGREGATORS: Record<AggregateFn, (nums: number[]) => number | undefined> = {
  sum: (nums) => nums.reduce((a, b) => a + b, 0),
  avg: (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0),
  min: (nums) => (nums.length ? Math.min(...nums) : undefined),
  max: (nums) => (nums.length ? Math.max(...nums) : undefined),
};

export const AGGREGATE_FNS = Object.keys(AGGREGATORS) as AggregateFn[];

export function aggregate(arr: Row[], key: string | undefined, fn: string | undefined): number | undefined {
  const f = AGGREGATORS[fn as AggregateFn];
  if (!f) throw new Error(`Unknown aggregate fn: ${fn}`);
  const nums = arr.map((item) => Number(getByPath(item, key))).filter((n) => !Number.isNaN(n));
  return f(nums);
}

export function sliceRows(arr: Row[], n: number, from: "first" | "last" = "first"): Row[] {
  return from === "last" ? arr.slice(-n) : arr.slice(0, n);
}

export interface DeepSearchMatch {
  path: string;
  value: unknown;
}

export function deepSearch(data: unknown, text: string | undefined): DeepSearchMatch[] {
  const needle = String(text).toLowerCase();
  const matches: DeepSearchMatch[] = [];
  function walk(value: unknown, path: string): void {
    if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : String(k));
      }
    } else if (String(value).toLowerCase().includes(needle)) {
      matches.push({ path, value });
    }
  }
  walk(data, "");
  return matches;
}

export function flattenByKey(arr: Row[], key: string | undefined): unknown[] {
  return arr.flatMap((item) => {
    const nested = getByPath(item, key);
    return Array.isArray(nested) ? nested : [];
  });
}

export function toCSV(arr: Row[]): string {
  if (!arr.length) return "";
  const headers = [...new Set(arr.flatMap((item) => Object.keys(item ?? {})))];
  const escape = (val: unknown): string => {
    const s = val === undefined || val === null ? "" : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const item of arr) lines.push(headers.map((h) => escape(item?.[h])).join(","));
  return lines.join("\n");
}

export function toDictionary(arr: Row[], key: string | undefined): Record<string, Row> {
  const result: Record<string, Row> = {};
  for (const item of arr) result[String(getByPath(item, key))] = item;
  return result;
}

export function flattenObject(obj: Row | null | undefined, prefix = ""): Row {
  const result: Row = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenObject(v as Row, path));
    } else {
      result[path] = v;
    }
  }
  return result;
}

export function listKeysDeep(obj: unknown): string[] {
  const keys: string[] = [];
  function walk(value: unknown, path: string): void {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) {
        const p = path ? `${path}.${k}` : k;
        keys.push(p);
        walk(v, p);
      }
    }
  }
  walk(obj, "");
  return keys;
}

// Escape hatch (SPEC.md §2) — free-text expression against the pipeline's
// current input, exposed to the expression as `data`. Accepts either a bare
// expression ("data.filter(x => x.active)") or a full statement body
// containing its own `return`.
export function runCustomExpression(data: unknown, code: string): unknown {
  const trimmed = String(code).trim();
  const isStatementBody = trimmed.startsWith("return") || trimmed.includes(";");
  const body = isStatementBody ? trimmed : `return (${trimmed});`;
  const fn = new Function("data", body) as (data: unknown) => unknown;
  return fn(data);
}
