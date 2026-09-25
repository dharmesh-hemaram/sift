import { test, expect } from "./fixtures.ts";
import type { Page } from "@playwright/test";
import type {} from "../../src/types.ts"; // pulls in the Window.__sift global augmentation

async function capture(page: Page, { url, status = 200, body }: { url: string; status?: number; body: string }) {
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

test("single-object response: pick keys + custom expression escape hatch", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel.html`);

  await capture(page, {
    url: "https://api.example.com/api/v2/profile/42",
    body: JSON.stringify({ id: 42, name: "Ada", email: "ada@example.com", internal: "secret" }),
  });
  await page.click(".rail-item");

  await page.selectOption(".add-step-select", "pick");
  const pickChip = page.locator(".step-chip").nth(0);
  const keysInput = pickChip.locator('input[type="text"]').first();
  await keysInput.fill("name, email");
  await keysInput.press("Tab");

  // pick on a single object renders as a key/value table, not per-field columns.
  const bodyText = await page.locator(".result-table tbody").innerText();
  expect(bodyText).toContain("name");
  expect(bodyText).toContain("Ada");
  expect(bodyText).not.toContain("secret");

  // Add the custom-expression escape hatch on top — always present per SPEC.md §2.
  await page.selectOption(".add-step-select", "custom");
  const customChip = page.locator(".step-chip").nth(1);
  const codeInput = customChip.locator("textarea.code-input");
  await codeInput.fill("({ upper: data.name.toUpperCase() })");
  await codeInput.press("Tab");

  await page.click(".result-tab:has-text('Raw')");
  const raw = JSON.parse(await page.locator("#result-body #json-view").innerText());
  expect(raw).toEqual({ upper: "ADA" });
});

// Export's "sample result is only attached when explicitly opted in"
// behavior is covered at the unit level (test/unit/exportImport.test.ts) —
// the export/import bar was removed from this view (moving under the
// Manage section) and no longer has a UI entry point here to drive an e2e
// check through.
