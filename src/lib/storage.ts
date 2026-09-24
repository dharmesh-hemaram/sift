// SPEC.md §4 — persist pipeline STRUCTURE only (steps + urlPattern), never
// captured response data. Takes the storage area as a parameter (rather
// than reading `chrome.storage.local` directly) so it's a plain, testable
// module with no implicit browser dependency.
import type { PipelineRecord, PipelineStep, PipelineStore, StorageArea } from "../types.ts";

const STORAGE_KEY = "sift.pipelines.v1";

type PipelineMap = Record<string, PipelineRecord>;

function get(area: StorageArea): Promise<PipelineMap> {
  return new Promise((resolve) => {
    area.get(STORAGE_KEY, (res) => resolve((res?.[STORAGE_KEY] as PipelineMap) ?? {}));
  });
}

function set(area: StorageArea, all: PipelineMap): Promise<void> {
  return new Promise((resolve) => {
    area.set({ [STORAGE_KEY]: all }, () => resolve());
  });
}

function makeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPipelineStore(area: StorageArea): PipelineStore {
  return {
    async load(urlPattern: string) {
      const all = await get(area);
      return all[urlPattern] ?? null;
    },

    async loadAll() {
      return get(area);
    },

    async save(urlPattern: string, steps: PipelineStep[], name?: string) {
      const all = await get(area);
      const existing = all[urlPattern];
      const now = new Date().toISOString();
      const record: PipelineRecord = {
        id: existing?.id ?? makeId(),
        name: name ?? existing?.name ?? urlPattern,
        urlPattern,
        steps,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      all[urlPattern] = record;
      await set(area, all);
      return record;
    },

    async remove(urlPattern: string) {
      const all = await get(area);
      delete all[urlPattern];
      await set(area, all);
    },

    async importRecord(record) {
      const all = await get(area);
      const now = new Date().toISOString();
      const saved: PipelineRecord = {
        id: record.id ?? makeId(),
        name: record.name ?? record.urlPattern,
        urlPattern: record.urlPattern,
        steps: record.steps ?? [],
        createdAt: record.createdAt ?? now,
        updatedAt: now,
      };
      all[record.urlPattern] = saved;
      await set(area, all);
      return saved;
    },
  };
}
