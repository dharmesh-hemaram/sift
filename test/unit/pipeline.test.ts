import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline, detectKeys, OP_DEFINITIONS, OP_DEFINITIONS_BY_ID } from "../../src/lib/pipeline.ts";

const accounts = [
  { code: "A1", balance: 100, status: "active" },
  { code: "A2", balance: 50, status: "inactive" },
  { code: "A3", balance: 200, status: "active" },
];

test("runPipeline chains steps end to end (extract -> filter -> sort)", async () => {
  const { result, stepResults } = await runPipeline(accounts, [
    { op: "extract", keys: ["code", "balance", "status"] },
    { op: "filter", conditions: [{ key: "status", operator: "=", value: "active" }] },
    { op: "sort", key: "balance", direction: "desc" },
  ]);
  assert.deepEqual(
    result.map((r) => r.code),
    ["A3", "A1"],
  );
  assert.equal(stepResults.length, 3);
  assert.ok(stepResults.every((s) => !s.broken));
});

test("runPipeline stops at the first failing step and marks it broken", async () => {
  const { result, stepResults } = await runPipeline(accounts, [
    { op: "extract", keys: ["code"] },
    { op: "aggregate", key: "balance", fn: "sum" }, // balance was dropped by extract above -> NaN filtered, sum=0, not an error actually
    { op: "unknownOp" },
  ]);
  // aggregate on missing field doesn't throw (filters NaN), so it succeeds with 0;
  // the truly broken step is the unknown op.
  assert.equal(stepResults[1].broken, false);
  assert.equal(stepResults[2].broken, true);
  assert.match(stepResults[2].error, /Unknown operation/);
  assert.equal(result, 0);
});

test("runPipeline: a throwing custom expression is marked broken and later steps are skipped", async () => {
  const { stepResults } = await runPipeline(accounts, [
    { op: "custom", code: "data.nope()" },
    { op: "sort", key: "balance" },
  ]);
  assert.equal(stepResults[0].broken, true);
  assert.equal(stepResults[1].skipped, true);
});

test("runPipeline: a handler override replaces just that op (panel.js uses this to sandbox 'custom')", async () => {
  const { result } = await runPipeline(accounts, [{ op: "custom", code: "ignored" }], {
    custom: async (data) => data.length, // fake async override, doesn't touch `code`
  });
  assert.equal(result, 3);
});

test("detectKeys: array-of-objects uses first object's keys, single object uses its own", () => {
  assert.deepEqual(detectKeys(accounts), ["code", "balance", "status"]);
  assert.deepEqual(detectKeys({ a: 1, b: 2 }), ["a", "b"]);
  assert.deepEqual(detectKeys([]), []);
  assert.deepEqual(detectKeys(42), []);
});

test("OP_DEFINITIONS: every id is unique and resolvable via the by-id map", () => {
  const ids = OP_DEFINITIONS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(OP_DEFINITIONS_BY_ID[id].id, id);
});

test("OP_DEFINITIONS: the custom-expression escape hatch is always present", () => {
  assert.ok(OP_DEFINITIONS.some((d) => d.id === "custom" && d.category === "custom"));
});
