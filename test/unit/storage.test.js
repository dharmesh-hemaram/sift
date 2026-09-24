import { test } from "node:test";
import assert from "node:assert/strict";
import { createPipelineStore } from "../../src/lib/storage.js";

// A minimal stand-in for chrome.storage.local's callback-based get/set,
// so the store logic is tested without a real browser.
function fakeArea() {
  const data = {};
  return {
    _data: data,
    get(key, cb) {
      cb({ [key]: data[key] });
    },
    set(obj, cb) {
      Object.assign(data, obj);
      cb();
    },
  };
}

test("save creates a record with id/timestamps, then load returns it", async () => {
  const store = createPipelineStore(fakeArea());
  const saved = await store.save("/api/v2/accounts", [{ op: "sort", key: "balance" }], "My pipeline");
  assert.ok(saved.id);
  assert.equal(saved.name, "My pipeline");
  assert.equal(saved.createdAt, saved.updatedAt);

  const loaded = await store.load("/api/v2/accounts");
  assert.deepEqual(loaded, saved);
});

test("saving again keeps the same id/createdAt but bumps updatedAt", async () => {
  const store = createPipelineStore(fakeArea());
  const first = await store.save("/api/v2/accounts", [{ op: "sort", key: "balance" }]);
  await new Promise((r) => setTimeout(r, 2));
  const second = await store.save("/api/v2/accounts", [{ op: "sort", key: "code" }]);

  assert.equal(second.id, first.id);
  assert.equal(second.createdAt, first.createdAt);
  assert.notDeepEqual(second.steps, first.steps);
});

test("load returns null for an unknown urlPattern", async () => {
  const store = createPipelineStore(fakeArea());
  assert.equal(await store.load("/nope"), null);
});

test("pipelines for different urlPatterns don't collide", async () => {
  const store = createPipelineStore(fakeArea());
  await store.save("/api/v2/accounts", [{ op: "sort", key: "balance" }]);
  await store.save("/api/v2/orders", [{ op: "sort", key: "date" }]);

  const all = await store.loadAll();
  assert.deepEqual(Object.keys(all).sort(), ["/api/v2/accounts", "/api/v2/orders"]);
});

test("remove deletes a saved pipeline", async () => {
  const store = createPipelineStore(fakeArea());
  await store.save("/api/v2/accounts", [{ op: "sort", key: "balance" }]);
  await store.remove("/api/v2/accounts");
  assert.equal(await store.load("/api/v2/accounts"), null);
});

test("importRecord stores an externally-provided pipeline record as-is (minus a fresh updatedAt)", async () => {
  const store = createPipelineStore(fakeArea());
  const imported = await store.importRecord({
    id: "fixed-id",
    name: "Imported",
    urlPattern: "/api/v2/accounts",
    steps: [{ op: "extract", keys: ["code"] }],
    createdAt: "2020-01-01T00:00:00.000Z",
  });
  assert.equal(imported.id, "fixed-id");
  assert.equal(imported.createdAt, "2020-01-01T00:00:00.000Z");
  assert.ok(imported.updatedAt);
});
