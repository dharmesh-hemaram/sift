// Shared type contracts for the whole app. Kept intentionally pragmatic —
// pipeline steps and combine params are dynamic, dictionary-like shapes by
// design (SPEC.md §3), so they're typed as "the fields every step might
// have" rather than a fully exhaustive per-op discriminated union.

export interface CapturedResponse {
  id: number;
  url: string;
  urlPattern: string;
  status: number;
  size: number;
  time: string;
  content: string;
  _parsed?: unknown;
}

export type FilterOperator = "=" | "!=" | ">" | "<" | "contains";

export interface FilterCondition {
  key: string;
  operator: FilterOperator;
  value: string;
  connector?: "AND" | "OR";
}

export type ParamType = "keys" | "key" | "conditions" | "text" | "number" | "select" | "code";

export interface OpParamDef {
  name: string;
  type: ParamType;
  label: string;
  options?: readonly string[];
  default?: string | number;
}

export type OpCategory = "array" | "object" | "custom";

export interface OpDefinition {
  id: string;
  label: string;
  category: OpCategory;
  params: readonly OpParamDef[];
}

export interface PipelineStep {
  op: string;
  keys?: string[];
  key?: string;
  conditions?: FilterCondition[];
  direction?: "asc" | "desc";
  fn?: string;
  n?: number;
  from?: "first" | "last";
  text?: string;
  path?: string;
  code?: string;
  [extra: string]: unknown;
}

export interface StepResult {
  step: PipelineStep;
  error: string | null;
  broken: boolean;
  skipped?: boolean;
}

export interface PipelineRunResult<T = unknown> {
  result: T;
  stepResults: StepResult[];
}

export type PipelineHandler = (data: unknown, step: PipelineStep) => unknown | Promise<unknown>;
export type PipelineHandlers = Record<string, PipelineHandler>;

export interface PipelineRecord {
  id: string;
  name: string;
  urlPattern: string;
  steps: PipelineStep[];
  createdAt: string;
  updatedAt: string;
  sampleResult?: unknown;
}

export interface ValidatedStep extends PipelineStep {
  broken: boolean;
  missingKeys: string[];
}

export interface ValidatedPipeline {
  steps: ValidatedStep[];
  urlPattern: string;
  [extra: string]: unknown;
}

export type CombineOpId = "concat" | "mergeByIndex" | "join" | "diff" | "intersect";

export interface CombineOperationDef {
  id: CombineOpId;
  label: string;
  minInputs: number;
  maxInputs: number;
  needsKey: boolean;
}

export interface CombineInputState {
  responseId: number | null;
  key: string;
}

export interface CombineEntry {
  data: unknown;
  key: string;
  fieldName?: string;
}

// chrome.storage.local's callback shape, kept minimal so lib/storage.ts
// doesn't need to import the (ambient, global) chrome.* types directly —
// this keeps it a plain, Node-testable module.
export interface StorageArea {
  get(key: string, callback: (result: Record<string, unknown>) => void): void;
  set(items: Record<string, unknown>, callback: () => void): void;
}

export interface PipelineStore {
  load(urlPattern: string): Promise<PipelineRecord | null>;
  loadAll(): Promise<Record<string, PipelineRecord>>;
  save(urlPattern: string, steps: PipelineStep[], name?: string): Promise<PipelineRecord>;
  remove(urlPattern: string): Promise<void>;
  importRecord(record: Partial<PipelineRecord> & { urlPattern: string }): Promise<PipelineRecord>;
}

// The shape panel.js hands chrome.devtools.network.onRequestFinished, and
// what capture.ts exposes as window.__sift for e2e tests to drive directly.
export interface DevToolsRequestLike {
  request: { url: string };
  response: { status: number; content: { mimeType: string } };
  getContent(callback: (content: string) => void): void;
}

declare global {
  interface Window {
    __sift?: { handleRequestFinished: (request: DevToolsRequestLike) => void };
  }
}
