import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  fullyParallel: false, // extension tests each launch their own persistent Chromium context
  reporter: [["list"]],
});
