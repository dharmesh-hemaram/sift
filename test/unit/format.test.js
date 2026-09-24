import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, escapeHtml, highlightJson, urlSlug } from "../../src/lib/format.js";

test("urlSlug: last path segment, query params ignored, root falls back to '/'", () => {
  assert.equal(urlSlug("https://jsonplaceholder.typicode.com/users"), "users");
  assert.equal(urlSlug("https://api.example.com/api/v2/accounts/123?x=1"), "123");
  assert.equal(urlSlug("https://api.example.com/"), "/");
  assert.equal(urlSlug("/not-a-full-url/posts"), "posts");
});

test("formatBytes: B/KB/MB thresholds", () => {
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});

test("escapeHtml: escapes & < > only", () => {
  assert.equal(escapeHtml(`<a href="x">A & B</a>`), "&lt;a href=\"x\"&gt;A &amp; B&lt;/a&gt;");
});

test("highlightJson: colors keys, strings, numbers, booleans, null", () => {
  const pretty = JSON.stringify({ a: "x", b: 1, c: true, d: null }, null, 2);
  const html = highlightJson(escapeHtml(pretty));
  assert.match(html, /<span class="json-key">"a":<\/span>/);
  assert.match(html, /<span class="json-string">"x"<\/span>/);
  assert.match(html, /<span class="json-number">1<\/span>/);
  assert.match(html, /<span class="json-boolean">true<\/span>/);
  assert.match(html, /<span class="json-null">null<\/span>/);
});
