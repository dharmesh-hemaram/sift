import { state, parsedData } from "../state.ts";
import { pipelineStore } from "../persistence.ts";
import { runPipeline } from "../lib/pipeline.ts";
import { buildExport, parseImport, validateImportedPipeline } from "../lib/exportImport.ts";
import { pipelineHandlerOverrides } from "../sandboxBridge.ts";
import { scheduleMainRender } from "../renderBus.ts";
import type { CapturedResponse } from "../types.ts";

export function renderExportImportBar(entry: CapturedResponse): HTMLElement {
  const bar = document.createElement("div");
  bar.id = "export-import-bar";

  const sampleLabel = document.createElement("label");
  sampleLabel.id = "include-sample-label";
  const sampleCheckbox = document.createElement("input");
  sampleCheckbox.type = "checkbox";
  sampleCheckbox.checked = state.includeSampleOnExport;
  sampleCheckbox.addEventListener("change", () => {
    state.includeSampleOnExport = sampleCheckbox.checked;
  });
  sampleLabel.append(sampleCheckbox, " Include sample result (may contain real API data)");

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Export sift";
  exportBtn.disabled = state.pipelineSteps.length === 0;
  exportBtn.addEventListener("click", () => {
    void exportCurrentPipeline(entry);
  });

  const importBtn = document.createElement("button");
  importBtn.textContent = "Import sift";
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.style.display = "none";
  importInput.addEventListener("change", () => {
    void handleImportFile(importInput.files?.[0] ?? null, entry);
  });
  importBtn.addEventListener("click", () => importInput.click());

  bar.append(exportBtn, importBtn, importInput, sampleLabel);

  if (state.importError) {
    const err = document.createElement("div");
    err.id = "import-error";
    err.textContent = state.importError;
    bar.appendChild(err);
  }

  return bar;
}

async function exportCurrentPipeline(entry: CapturedResponse): Promise<void> {
  // Steps always come from the live in-memory pipeline, not storage — the
  // debounced save may not have landed yet. Only id/name/createdAt are
  // borrowed from the stored record, for continuity across exports.
  const stored = pipelineStore && (await pipelineStore.load(entry.urlPattern));
  const record = {
    id: stored?.id ?? "unsaved",
    name: stored?.name ?? entry.urlPattern,
    urlPattern: entry.urlPattern,
    steps: state.pipelineSteps,
    createdAt: stored?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let samples: Record<string, unknown> = {};
  if (state.includeSampleOnExport) {
    const { result } = await runPipeline(parsedData(entry), state.pipelineSteps, pipelineHandlerOverrides);
    samples = { [entry.urlPattern]: result };
  }

  const exported = buildExport(record, { includeSample: state.includeSampleOnExport, samples });
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sift-${entry.urlPattern.replace(/[^a-z0-9]+/gi, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImportFile(file: File | null, entry: CapturedResponse): Promise<void> {
  state.importError = null;
  if (!file) return;
  try {
    const text = await file.text();
    const [imported] = parseImport(text);
    const validated = validateImportedPipeline(imported!, parsedData(entry));
    if (pipelineStore) await pipelineStore.importRecord(validated);
    if (validated.urlPattern === entry.urlPattern) {
      state.pipelineSteps = validated.steps;
    }
  } catch (err) {
    state.importError = (err as Error).message;
  }
  scheduleMainRender();
}
