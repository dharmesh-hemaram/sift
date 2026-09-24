import { test, expect } from "./fixtures.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function capture(page, { url, status = 200, body }) {
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

test("export: sample result is only attached when explicitly opted in", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/panel.html`);

  await capture(page, {
    url: "https://api.example.com/api/v2/widgets",
    body: JSON.stringify([{ id: 1, label: "one" }]),
  });
  await page.click(".rail-item");
  await page.selectOption(".add-step-select", "extract");
  const keysInput = page.locator(".step-chip").first().locator('input[type="text"]').first();
  await keysInput.fill("id");
  await keysInput.press("Tab");

  await page.locator("#include-sample-label input[type=checkbox]").check();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("button", { hasText: "Export pipeline" }).click(),
  ]);
  const downloadPath = path.join(os.tmpdir(), `sift-sample-export-${Date.now()}.json`);
  await download.saveAs(downloadPath);
  const exported = JSON.parse(await fs.readFile(downloadPath, "utf8"));
  await fs.unlink(downloadPath);

  expect(exported[0].sampleResult).toEqual([{ id: 1 }]);
});
