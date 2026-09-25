import { test, expect } from "./fixtures.ts";
import type { Page } from "@playwright/test";
import type {} from "../../src/types.ts"; // pulls in the Window.__sift global augmentation
import assert from "node:assert/strict";

const SAMPLE_URL = "https://api.example.com/api/v2/accounts/123";

async function capture(
  page: Page,
  { url = SAMPLE_URL, status = 200, body }: { url?: string; status?: number; body: string },
) {
  await page.evaluate(
    ({ url, status, body }) => {
      window.__sift!.handleRequestFinished({
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

test("full journey: capture -> pipeline -> table/raw result -> persists across reload", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel.html`);

  // --- capture ---
  await capture(page, { body: ACCOUNTS_JSON });
  await expect(page.locator(".rail-item")).toHaveCount(1);
  await page.click(".rail-item");

  // No steps yet -> Table/Raw is still available, defaulting to Table, not
  // just a bare raw view (the raw captured response is a valid "result" too).
  await expect(page.locator(".step-chip")).toHaveCount(0);
  await expect(page.locator(".result-tab")).toHaveCount(2);
  await expect(page.locator(".result-tab.active")).toHaveText("Table");
  await expect(page.locator(".result-table")).toContainText("A1");
  await page.click(".result-tab:has-text('Raw')");
  await expect(page.locator("#json-view")).toContainText('"code"');
  await page.click(".result-tab:has-text('Table')"); // back to default before building steps below

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

  // Export defaults to structure-only — covered at the unit level
  // (test/unit/exportImport.test.ts). The export/import bar was removed
  // from this view (moving under the Manage section) so there's no UI
  // entry point here to drive that check through anymore.

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

  // Import flagging a step referencing a missing key was previously driven
  // through the export/import bar's file input, now removed from this view
  // (moving under the Manage section). validateImportedPipeline's own
  // broken-step detection is still covered at the unit level
  // (test/unit/exportImport.test.ts).

  await page.close();
});

function assertAccountCodesDescByBalance(data: unknown) {
  const rows = data as Array<{ code: string }>;
  if (!Array.isArray(rows) || rows.length !== 2 || rows[0]?.code !== "A3" || rows[1]?.code !== "A1") {
    throw new Error(`Unexpected raw result: ${JSON.stringify(data)}`);
  }
}
