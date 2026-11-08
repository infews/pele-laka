import { test, expect } from "@playwright/test";
import { startServer } from "../src/server.js";

// Smoke test that the browser tooling works; PREVIEW evals go here.
test("the preview page shows the served diagram", async ({ page }) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" id="d"><g/></svg>';
  const server = await startServer({ port: 0, render: () => ({ svgs: { auto: svg, light: svg, dark: svg }, palettes: [] }) });
  try {
    await page.goto(server.url);
    await expect(page.locator("#pp-stage > svg#d")).toBeAttached();
  } finally {
    await server.close();
  }
});
