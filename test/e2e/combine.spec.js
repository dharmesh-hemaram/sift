import { test, expect } from "./fixtures.js";

async function capture(page, { url, body }) {
  await page.evaluate(
    ({ url, body }) => {
      window.__sift.handleRequestFinished({
        request: { url },
        response: { status: 200, content: { mimeType: "application/json" } },
        getContent: (cb) => cb(body),
      });
    },
    { url, body },
  );
}

const ACCOUNTS = JSON.stringify([
  { accountCode: "A1", name: "Ada" },
  { accountCode: "A2", name: "Grace" },
]);
const ORDERS = JSON.stringify([
  { accountCode: "A1", total: 100 },
  { accountCode: "A1", total: 50 },
]);

test("combine: join two captured responses by key via the plain dropdown picker", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel.html`);

  await capture(page, { url: "https://api.example.com/api/v2/accounts", body: ACCOUNTS });
  await capture(page, { url: "https://api.example.com/api/v2/orders", body: ORDERS });
  await expect(page.locator(".rail-item")).toHaveCount(2);

  await page.click("#combine-toggle-btn");
  await expect(page.locator("#combine-view")).toBeVisible();
  await expect(page.locator("#combine-error")).toContainText("Pick a captured response");

  await page.selectOption("#combine-op-select", "join");

  const rows = page.locator(".combine-input-row");
  await expect(rows).toHaveCount(2);

  await rows.nth(0).locator(".combine-input-select").selectOption({ label: "https://api.example.com/api/v2/accounts (/api/v2/accounts)" });
  await rows.nth(0).locator('input[type="text"]').fill("accountCode");
  await rows.nth(0).locator('input[type="text"]').press("Tab");

  await rows.nth(1).locator(".combine-input-select").selectOption({ label: "https://api.example.com/api/v2/orders (/api/v2/orders)" });
  await rows.nth(1).locator('input[type="text"]').fill("accountCode");
  await rows.nth(1).locator('input[type="text"]').press("Tab");

  // Nested join: one row per account (the base), not one row per match —
  // Grace/A2 has no orders but is still kept, with an empty array.
  const tableBody = page.locator("#combine-view .result-table tbody");
  await expect(tableBody.locator("tr")).toHaveCount(2);

  await page.click("#combine-view .result-tab:has-text('Raw')");
  const raw = JSON.parse(await page.locator("#combine-view #result-body #json-view").innerText());
  const ada = raw.find((r) => r.accountCode === "A1");
  const grace = raw.find((r) => r.accountCode === "A2");
  expect(ada.name).toBe("Ada");
  expect(ada.orders.map((o) => o.total).sort((a, b) => a - b)).toEqual([50, 100]);
  expect(grace.name).toBe("Grace");
  expect(grace.orders).toEqual([]); // no matching orders, kept rather than dropped

  await page.click("#combine-view .result-tab:has-text('Table')");

  // Diff/Intersect are capped at 2 inputs — no "+ Add input" once at the cap.
  await page.selectOption("#combine-op-select", "diff");
  await expect(page.locator("#combine-add-input")).toHaveCount(0);

  // Concat doesn't need a key field at all.
  await page.selectOption("#combine-op-select", "concat");
  await expect(page.locator(".combine-input-row input[type=\"text\"]")).toHaveCount(0);
  const concatBody = page.locator("#combine-view .result-table tbody");
  await expect(concatBody.locator("tr")).toHaveCount(4); // 2 accounts + 2 orders, unfiltered

  await page.close();
});
