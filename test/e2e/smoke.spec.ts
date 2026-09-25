import { test, expect } from "./fixtures.ts";

test("extension loads unpacked and panel.html opens without console errors", async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);

  const page = await context.newPage();
  const errors: Error[] = [];
  page.on("pageerror", (err) => errors.push(err));

  await page.goto(`chrome-extension://${extensionId}/panel.html`);
  await expect(page.locator("#rail-header")).toContainText("Responses");
  await expect(page.locator("#empty-state")).toContainText("Reload the inspected page");

  expect(errors).toEqual([]);
});
