import { test, expect } from "./fixtures.js";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SAMPLE_URL = "https://api.example.com/api/v2/accounts/123";

async function capture(page, { url = SAMPLE_URL, status = 200, body }) {
  await page.evaluate(
    ({ url, status, body }) => {
      window.__sift.handleRequestFinished({
        request: { url },
        response: { status, content: { mimeType: "application/json" } },
        getContent: (cb) => cb(body),
      });
    },
    { url, status, body },
  );
}

const ACCOUNTS_JSON = JSON.stringify([
  { code: "A1", balance: 100, status: "active" },
  { code: "A2", balance: 50, status: "inactive" },
  { code: "A3", balance: 200, status: "active" },
]);

test("full journey: capture -> pipeline -> table/raw result -> export -> persists across reload -> import flags a broken step", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel.html`);

  // --- capture ---
  await capture(page, { body: ACCOUNTS_JSON });
  await expect(page.locator(".rail-item")).toHaveCount(1);
  await page.click(".rail-item");

  // Phase 1: no pipeline steps yet -> raw formatted JSON of the response itself.
  await expect(page.locator("#json-view")).toContainText('"code"');
  await expect(page.locator(".step-chip")).toHaveCount(0);

  // --- Phase 2/3: build extract -> filter -> sort ---
  await page.selectOption(".add-step-select", "extract");
  const extractChip = page.locator(".step-chip").nth(0);
  const extractKeys = extractChip.locator('input[type="text"]').first();
  await extractKeys.fill("code, balance, status");
  await extractKeys.press("Tab");

  await page.selectOption(".add-step-select", "filter");
  const filterChip = page.locator(".step-chip").nth(1);
  await filterChip.locator(".add-condition").click();
  const condRow = filterChip.locator(".condition-row").first();
  await condRow.locator('input[placeholder="field"]').fill("status");
  await condRow.locator("select").selectOption("=");
  const valueInput = condRow.locator('input[placeholder="value"]');
  await valueInput.fill("active");
  await valueInput.press("Tab");

  await page.selectOption(".add-step-select", "sort");
  const sortChip = page.locator(".step-chip").nth(2);
  const sortKey = sortChip.locator('input[type="text"]').first();
  await sortKey.fill("balance");
  await sortKey.press("Tab");
  await sortChip.locator("select").selectOption("desc");

  await expect(page.locator(".step-chip")).toHaveCount(3);
  await expect(page.locator("#broken-banner")).toHaveCount(0);

  // --- result: Table view ---
  await expect(page.locator(".result-tab.active")).toHaveText("Table");
  const rows = page.locator(".result-table tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("A3");
  await expect(rows.nth(1)).toContainText("A1");
  const headerText = await page.locator(".result-table thead").innerText();
  for (const key of ["code", "balance", "status"]) assert(headerText.includes(key), `header missing ${key}`);

  // --- result: Raw view ---
  await page.click(".result-tab:has-text('Raw')");
  const rawText = await page.locator("#result-body #json-view").innerText();
  const parsedRaw = JSON.parse(rawText);
  assertAccountCodesDescByBalance(parsedRaw);

  // --- Phase 5: export defaults to structure-only ---
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("button", { hasText: "Export pipeline" }).click(),
  ]);
  const downloadPath = path.join(os.tmpdir(), `sift-export-${Date.now()}.json`);
  await download.saveAs(downloadPath);
  const exported = JSON.parse(await fs.readFile(downloadPath, "utf8"));
  expect(exported[0].urlPattern).toBe("/api/v2/accounts/:id");
  expect(exported[0].steps).toHaveLength(3);
  expect(exported[0]).not.toHaveProperty("sampleResult");
  await fs.unlink(downloadPath);

  // --- Phase 4: persistence survives a panel reload (real chrome.storage.local) ---
  // Saves are debounced (300ms) so real edits aren't a storage write per keystroke;
  // give the last one time to land before simulating the panel being reopened.
  await page.waitForTimeout(400);
  await page.reload();
  await capture(page, { body: ACCOUNTS_JSON });
  await expect(page.locator(".rail-item")).toHaveCount(1);
  await page.click(".rail-item");
  await expect(page.locator(".step-chip")).toHaveCount(3, {
    // No steps were re-added after reload — this only passes if the
    // pipeline was actually reloaded from chrome.storage.local.
  });

  // --- Phase 5: import flags a step referencing a key this response doesn't have ---
  const brokenPipeline = [
    {
      id: "imported-1",
      name: "Imported broken pipeline",
      urlPattern: "/api/v2/accounts/:id",
      steps: [{ op: "filter", conditions: [{ key: "region", operator: "=", value: "us" }] }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const importPath = path.join(os.tmpdir(), `sift-import-${Date.now()}.json`);
  await fs.writeFile(importPath, JSON.stringify(brokenPipeline));
  await page.locator('input[type="file"]').setInputFiles(importPath);
  await fs.unlink(importPath);

  await expect(page.locator("#broken-banner")).toContainText("key not found in this response");
  await expect(page.locator("#broken-banner")).toContainText("region");
  // The broken step stays visible (greyed via the banner) instead of being silently dropped.
  await expect(page.locator(".step-chip")).toHaveCount(1);

  await page.close();
});

function assertAccountCodesDescByBalance(data) {
  if (!Array.isArray(data) || data.length !== 2 || data[0].code !== "A3" || data[1].code !== "A1") {
    throw new Error(`Unexpected raw result: ${JSON.stringify(data)}`);
  }
}
