// SPEC.md §5 — export/import. Pure data shaping + validation; the actual
// file download/upload mechanics (Blob, <a download>, <input type=file>)
// live in panel.js since they need the DOM.
import { detectKeys } from "./pipeline.js";

function stepKeys(step) {
  switch (step.op) {
    case "extract":
    case "pick":
    case "omit":
      return step.keys ?? [];
    case "filter":
      return (step.conditions ?? []).map((c) => c.key).filter(Boolean);
    case "sort":
    case "groupBy":
    case "countBy":
    case "unique":
    case "duplicates":
    case "aggregate":
    case "flattenArray":
    case "toDictionary":
      return step.key ? [step.key] : [];
    default:
      return [];
  }
}

// Export target: JSON file containing one pipeline definition (or an array
// of them). Defaults to structure-only; a sample result is only attached
// when explicitly opted in, keyed by urlPattern, and never sourced from the
// raw captured response — only from an already-computed pipeline result.
export function buildExport(pipelines, { includeSample = false, samples = {} } = {}) {
  const list = Array.isArray(pipelines) ? pipelines : [pipelines];
  return list.map((p) => {
    const record = {
      id: p.id,
      name: p.name,
      urlPattern: p.urlPattern,
      steps: p.steps,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    if (includeSample && Object.prototype.hasOwnProperty.call(samples, p.urlPattern)) {
      record.sampleResult = samples[p.urlPattern];
    }
    return record;
  });
}

export function parseImport(jsonText) {
  const data = JSON.parse(jsonText);
  const list = Array.isArray(data) ? data : [data];
  for (const p of list) {
    if (!p || typeof p !== "object" || !p.urlPattern || !Array.isArray(p.steps)) {
      throw new Error("Not a valid Sift pipeline export: expected { urlPattern, steps }");
    }
  }
  return list;
}

// Validates each step's expected key(s) against the currently loaded
// response's shape. A step whose key doesn't exist is marked `broken`
// (greyed out, "key not found in this response") rather than the pipeline
// silently returning an empty result (SPEC.md §5).
export function validateImportedPipeline(pipeline, sampleData) {
  const availableKeys = new Set(detectKeys(sampleData));
  const steps = (pipeline.steps ?? []).map((step) => {
    const required = stepKeys(step);
    const missingKeys = required.filter((k) => k && !availableKeys.has(String(k).split(".")[0]));
    return { ...step, broken: missingKeys.length > 0, missingKeys };
  });
  return { ...pipeline, steps };
}
