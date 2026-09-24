import { test } from "node:test";
import assert from "node:assert/strict";
import * as ops from "../../src/lib/ops.ts";

const accounts = [
  { code: "A1", balance: 100, status: "active", meta: { region: "us" } },
  { code: "A2", balance: 50, status: "inactive", meta: { region: "eu" } },
  { code: "A3", balance: 200, status: "active", meta: { region: "us" } },
];

test("getByPath: simple and nested, missing returns undefined", () => {
  assert.equal(ops.getByPath({ a: { b: 1 } }, "a.b"), 1);
  assert.equal(ops.getByPath({ a: 1 }, "missing"), undefined);
  assert.equal(ops.getByPath(null, "a.b"), null);
});

test("pickKeys / omitKeys", () => {
  assert.deepEqual(ops.pickKeys({ a: 1, b: 2, c: 3 }, ["a", "c"]), { a: 1, c: 3 });
  assert.deepEqual(ops.omitKeys({ a: 1, b: 2, c: 3 }, ["b"]), { a: 1, c: 3 });
});

test("extractFields", () => {
  assert.deepEqual(ops.extractFields(accounts, ["code", "balance"]), [
    { code: "A1", balance: 100 },
    { code: "A2", balance: 50 },
    { code: "A3", balance: 200 },
  ]);
});

test("filterRows: single condition per operator", () => {
  assert.equal(ops.filterRows(accounts, [{ key: "status", operator: "=", value: "active" }]).length, 2);
  assert.equal(ops.filterRows(accounts, [{ key: "status", operator: "!=", value: "active" }]).length, 1);
  assert.equal(ops.filterRows(accounts, [{ key: "balance", operator: ">", value: 60 }]).length, 2);
  assert.equal(ops.filterRows(accounts, [{ key: "balance", operator: "<", value: 60 }]).length, 1);
  assert.equal(ops.filterRows(accounts, [{ key: "code", operator: "contains", value: "a1" }]).length, 1);
});

test("filterRows: AND/OR chaining, nested key via dot path", () => {
  const andResult = ops.filterRows(accounts, [
    { key: "status", operator: "=", value: "active" },
    { key: "meta.region", operator: "=", value: "us", connector: "AND" },
  ]);
  assert.equal(andResult.length, 2);

  const orResult = ops.filterRows(accounts, [
    { key: "status", operator: "=", value: "inactive" },
    { key: "balance", operator: ">", value: 150, connector: "OR" },
  ]);
  assert.deepEqual(
    orResult.map((r) => r.code),
    ["A2", "A3"],
  );
});

test("sortRows: asc/desc, nulls last regardless of direction", () => {
  const withNulls = [{ v: 2 }, { v: null }, { v: 1 }];
  assert.deepEqual(
    ops.sortRows(withNulls, "v", "asc").map((r) => r.v),
    [1, 2, null],
  );
  assert.deepEqual(
    ops.sortRows(withNulls, "v", "desc").map((r) => r.v),
    [2, 1, null],
  );
  assert.deepEqual(
    ops.sortRows(accounts, "balance", "desc").map((r) => r.code),
    ["A3", "A1", "A2"],
  );
});

test("groupBy / countBy", () => {
  const grouped = ops.groupBy(accounts, "status");
  assert.equal(grouped.active.length, 2);
  assert.equal(grouped.inactive.length, 1);
  assert.deepEqual(ops.countBy(accounts, "status"), { active: 2, inactive: 1 });
});

test("uniqueValues / findDuplicates", () => {
  assert.deepEqual(ops.uniqueValues(accounts, "status"), ["active", "inactive"]);
  const dupData = [{ k: "x" }, { k: "x" }, { k: "y" }];
  const dups = ops.findDuplicates(dupData, "k");
  assert.equal(Object.keys(dups).length, 1);
  assert.equal(dups.x.length, 2);
});

test("aggregate: sum/avg/min/max", () => {
  assert.equal(ops.aggregate(accounts, "balance", "sum"), 350);
  assert.equal(ops.aggregate(accounts, "balance", "avg"), 350 / 3);
  assert.equal(ops.aggregate(accounts, "balance", "min"), 50);
  assert.equal(ops.aggregate(accounts, "balance", "max"), 200);
  assert.throws(() => ops.aggregate(accounts, "balance", "bogus"));
});

test("sliceRows: first and last N", () => {
  assert.deepEqual(
    ops.sliceRows(accounts, 2, "first").map((r) => r.code),
    ["A1", "A2"],
  );
  assert.deepEqual(
    ops.sliceRows(accounts, 2, "last").map((r) => r.code),
    ["A2", "A3"],
  );
});

test("deepSearch: matches across nested leaves with dot-path breadcrumbs", () => {
  const matches = ops.deepSearch(accounts, "eu");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].path, "1.meta.region");
});

test("flattenByKey: flatMap over a nested array field", () => {
  const data = [{ tags: ["a", "b"] }, { tags: ["c"] }, { tags: null }];
  assert.deepEqual(ops.flattenByKey(data, "tags"), ["a", "b", "c"]);
});

test("toCSV: header row + escaping of commas/quotes", () => {
  const csv = ops.toCSV([
    { name: "Ada", note: "hello, world" },
    { name: 'Grace "the ace"', note: "plain" },
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "name,note");
  assert.equal(lines[1], 'Ada,"hello, world"');
  assert.equal(lines[2], '"Grace ""the ace""",plain');
});

test("toCSV: empty array yields empty string", () => {
  assert.equal(ops.toCSV([]), "");
});

test("toDictionary: keyBy", () => {
  assert.deepEqual(ops.toDictionary(accounts, "code"), {
    A1: accounts[0],
    A2: accounts[1],
    A3: accounts[2],
  });
});

test("flattenObject: dot-path flattening, arrays kept intact", () => {
  const nested = { a: 1, b: { c: 2, d: { e: 3 } }, list: [1, 2] };
  assert.deepEqual(ops.flattenObject(nested), { a: 1, "b.c": 2, "b.d.e": 3, list: [1, 2] });
});

test("listKeysDeep: recursive key enumeration, skips arrays", () => {
  const nested = { a: 1, b: { c: 2, d: { e: 3 } } };
  assert.deepEqual(ops.listKeysDeep(nested), ["a", "b", "b.c", "b.d", "b.d.e"]);
});

test("runCustomExpression: bare expression form", () => {
  const result = ops.runCustomExpression(accounts, "data.filter(x => x.status === 'active').length");
  assert.equal(result, 2);
});

test("runCustomExpression: statement-body form with explicit return", () => {
  const result = ops.runCustomExpression(
    accounts,
    "const active = data.filter(x => x.status === 'active'); return active.length;",
  );
  assert.equal(result, 2);
});
