import { defineConfig } from "@playwright/test";

// Browser tests for the preview page live in e2e/, outside test/, so
// `node --test` doesn't pick them up.
export default defineConfig({
  testDir: "e2e",
  use: { browserName: "chromium", headless: true },
});
