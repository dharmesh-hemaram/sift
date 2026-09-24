import { test } from "node:test";
import assert from "node:assert/strict";
import {
  concat,
  mergeByIndex,
  joinByKey,
  fieldNameFromUrlPattern,
  diffByKey,
  intersectByKey,
  runCombine,
  COMBINE_OPERATIONS,
} from "../../src/lib/combine.js";

const accounts = [
  { accountCode: "A1", name: "Ada" },
  { accountCode: "A2", name: "Grace" },
];
const orders = [
  { accountCode: "A1", total: 100 },
  { accountCode: "A1", total: 50 },
  { accountCode: "A3", total: 10 }, // no matching account
];

test("concat: flattens N array inputs into one", () => {
  assert.deepEqual(concat([[1, 2], [3], [4, 5]]), [1, 2, 3, 4, 5]);
});

test("mergeByIndex: element-wise merge, shorter arrays pad with {}", () => {
  const a = [{ x: 1 }, { x: 2 }];
  const b = [{ y: "a" }];
  assert.deepEqual(mergeByIndex([a, b]), [{ x: 1, y: "a" }, { x: 2 }]);
});

test("joinByKey: nests matches under a field on the base row — one row per base item, not per match", () => {
  const result = joinByKey([
    { data: accounts, key: "accountCode" },
    { data: orders, key: "accountCode", fieldName: "orders" },
  ]);
  assert.equal(result.length, 2); // one row per account, not per (account, order) pair
  const a1 = result.find((r) => r.accountCode === "A1");
  const a2 = result.find((r) => r.accountCode === "A2");
  assert.equal(a1.name, "Ada");
  assert.deepEqual(
    a1.orders.map((o) => o.total).sort((a, b) => a - b),
    [50, 100],
  );
  // A2 has no matching orders — kept, with an empty array, not dropped.
  assert.deepEqual(a2.orders, []);
});

test("joinByKey: N inputs each nest independently under the base (star join, not sequential chaining)", () => {
  const regions = [{ accountCode: "A1", region: "us" }];
  const result = joinByKey([
    { data: accounts, key: "accountCode" },
    { data: orders, key: "accountCode", fieldName: "orders" },
    { data: regions, key: "accountCode", fieldName: "regions" },
  ]);
  assert.equal(result.length, 2);
  const a1 = result.find((r) => r.accountCode === "A1");
  assert.equal(a1.orders.length, 2);
  assert.deepEqual(a1.regions, [{ accountCode: "A1", region: "us" }]);
});

test("joinByKey: fewer than 2 inputs throws", () => {
  assert.throws(() => joinByKey([{ data: accounts, key: "accountCode" }]), /at least 2 inputs/);
});

test("fieldNameFromUrlPattern: last non-:id segment, falls back to 'items'", () => {
  assert.equal(fieldNameFromUrlPattern("/api/v2/accounts/:id"), "accounts");
  assert.equal(fieldNameFromUrlPattern("/posts"), "posts");
  assert.equal(fieldNameFromUrlPattern("/:id/:id"), "items");
  assert.equal(fieldNameFromUrlPattern("/"), "items");
});

test("diffByKey: rows in A whose key has no match in B", () => {
  const result = diffByKey(accounts, "accountCode", orders, "accountCode");
  assert.deepEqual(result.map((r) => r.accountCode), ["A2"]);
});

test("intersectByKey: rows in A whose key does have a match in B", () => {
  const result = intersectByKey(accounts, "accountCode", orders, "accountCode");
  assert.deepEqual(result.map((r) => r.accountCode), ["A1"]);
});

test("runCombine: dispatches to the right operation by id", () => {
  assert.deepEqual(runCombine("concat", [{ data: [1] }, { data: [2] }]), [1, 2]);
  const joined = runCombine("join", [
    { data: accounts, key: "accountCode" },
    { data: orders, key: "accountCode", fieldName: "orders" },
  ]);
  assert.deepEqual(
    joined.map((r) => r.accountCode),
    ["A1", "A2"],
  );
});

test("runCombine: diff/intersect enforce a hard cap of 2 inputs (SPEC.md §2)", () => {
  const def = COMBINE_OPERATIONS.find((d) => d.id === "diff");
  assert.equal(def.maxInputs, 2);
  assert.throws(
    () => runCombine("diff", [{ data: [], key: "k" }, { data: [], key: "k" }, { data: [], key: "k" }]),
    /capped at 2/,
  );
});

test("runCombine: join/concat/mergeByIndex are uncapped", () => {
  for (const id of ["join", "concat", "mergeByIndex"]) {
    const def = COMBINE_OPERATIONS.find((d) => d.id === id);
    assert.equal(def.maxInputs, Infinity);
  }
});

test("runCombine: key-requiring ops reject a missing key", () => {
  assert.throws(() => runCombine("join", [{ data: [], key: "" }, { data: [], key: "k" }]), /needs a key/);
});

test("runCombine: below minInputs throws", () => {
  assert.throws(() => runCombine("concat", [{ data: [1] }]), /at least 2 inputs/);
});
