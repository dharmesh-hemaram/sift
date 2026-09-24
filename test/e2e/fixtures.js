import { test as base, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const extensionPath = path.resolve(__dirname, "../../src");

export const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let page = context.pages().find((p) => p.url().startsWith("chrome://"));
    page ??= await context.newPage();
    await page.goto("chrome://extensions/");
    const id = await page.evaluate(() => {
      const manager = document.querySelector("extensions-manager");
      const itemList = manager.shadowRoot.querySelector("extensions-item-list");
      const item = itemList.shadowRoot.querySelector("extensions-item");
      return item.id;
    });
    await page.close();
    await use(id);
  },
});

export const expect = test.expect;
