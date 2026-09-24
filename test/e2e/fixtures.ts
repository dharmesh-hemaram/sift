import { test as base, chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The real, unpacked, BUILT extension — not src/, since Chrome can't load
// the .ts sources directly. Run `npm run build` first (test:e2e does this).
export const extensionPath = path.resolve(__dirname, "../../dist");

interface Fixtures {
  extensionId: string;
}

export const test = base.extend<Fixtures>({
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
      const manager = document.querySelector("extensions-manager") as HTMLElement & { shadowRoot: ShadowRoot };
      const itemList = manager.shadowRoot.querySelector("extensions-item-list") as HTMLElement & {
        shadowRoot: ShadowRoot;
      };
      const item = itemList.shadowRoot.querySelector("extensions-item") as HTMLElement;
      return item.id;
    });
    await page.close();
    await use(id);
  },
});

export const expect = test.expect;
