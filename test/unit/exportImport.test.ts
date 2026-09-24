import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExport, parseImport, validateImportedPipeline } from "../../src/lib/exportImport.ts";

const pipeline = {
  id: "1",
  name: "Active accounts by balance",
  urlPattern: "/api/v2/accounts",
  steps: [
    { op: "extract", keys: ["code", "balance", "status"] },
    { op: "filter", conditions: [{ key: "status", operator: "=", value: "active" }] },
    { op: "sort", key: "balance", direction: "desc" },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("buildExport defaults to structure-only, no sample data", () => {
  const [exported] = buildExport(pipeline);
  assert.deepEqual(Object.keys(exported).sort(), ["createdAt", "id", "name", "steps", "updatedAt", "urlPattern"]);
  assert.ok(!("sampleResult" in exported));
});

test("buildExport attaches sampleResult only when explicitly opted in", () => {
  const sample = [{ code: "A1", balance: 100 }];
  const [withoutOptIn] = buildExport(pipeline, { samples: { "/api/v2/accounts": sample } });
  assert.ok(!("sampleResult" in withoutOptIn));

  const [withOptIn] = buildExport(pipeline, { includeSample: true, samples: { "/api/v2/accounts": sample } });
  assert.deepEqual(withOptIn.sampleResult, sample);
});

test("buildExport accepts an array of pipelines", () => {
  const exported = buildExport([pipeline, { ...pipeline, id: "2", urlPattern: "/api/v2/orders" }]);
  assert.equal(exported.length, 2);
});

test("parseImport accepts a single object or an array, rejects malformed input", () => {
  assert.equal(parseImport(JSON.stringify(pipeline)).length, 1);
  assert.equal(parseImport(JSON.stringify([pipeline, pipeline])).length, 2);
  assert.throws(() => parseImport(JSON.stringify({ notAPipeline: true })), /Not a valid Sift pipeline export/);
  assert.throws(() => parseImport("{not json"));
});

test("validateImportedPipeline: matching keys stay clean", () => {
  const sample = [{ code: "A1", balance: 100, status: "active" }];
  const result = validateImportedPipeline(pipeline, sample);
  assert.ok(result.steps.every((s) => !s.broken));
});

test("validateImportedPipeline: a step referencing a missing key is marked broken, not dropped", () => {
  // Only the filter step references a field the current response lacks;
  // extract/sort only touch fields that do exist, so they should stay clean.
  const isolatedPipeline = {
    ...pipeline,
    steps: [
      { op: "extract", keys: ["code", "balance"] },
      { op: "filter", conditions: [{ key: "region", operator: "=", value: "us" }] },
      { op: "sort", key: "balance", direction: "desc" },
    ],
  };
  const sample = [{ code: "A1", balance: 100 }];
  const result = validateImportedPipeline(isolatedPipeline, sample);
  const [extractStep, filterStep, sortStep] = result.steps;
  assert.equal(extractStep.broken, false);
  assert.equal(filterStep.broken, true);
  assert.deepEqual(filterStep.missingKeys, ["region"]);
  assert.equal(sortStep.broken, false);
  assert.equal(result.steps.length, 3, "broken step stays in the pipeline instead of being dropped");
});
