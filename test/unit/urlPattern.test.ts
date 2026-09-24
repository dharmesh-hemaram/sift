import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrlPattern } from "../../src/lib/urlPattern.ts";

test("collapses numeric ID segments", () => {
  assert.equal(normalizeUrlPattern("https://api.example.com/api/v2/accounts/123"), "/api/v2/accounts/:id");
});

test("collapses uuid segments", () => {
  assert.equal(normalizeUrlPattern("https://api.example.com/users/550e8400-e29b-41d4-a716-446655440000"), "/users/:id");
});

test("strips query params", () => {
  assert.equal(normalizeUrlPattern("https://api.example.com/api/v2/accounts?page=2&limit=10"), "/api/v2/accounts");
});

test("leaves non-ID segments untouched", () => {
  assert.equal(normalizeUrlPattern("https://api.example.com/api/v2/accounts/active"), "/api/v2/accounts/active");
});

test("falls back to naive split for unparseable input, still collapsing IDs", () => {
  assert.equal(normalizeUrlPattern("/not-a-full-url/42?x=1"), "/not-a-full-url/:id");
});
