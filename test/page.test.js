// Smoke test that the browser tooling works: the preview page shows what the
// server serves. Internal; the PREVIEW evals drive the page in earnest.
import { chromium } from "playwright";
import { startServer } from "../src/server.js";

describe("the preview page", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); });
  afterAll(async () => { await browser?.close(); });

  it("shows the served diagram", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" id="d"><g/></svg>';
    const server = await startServer({ port: 0, render: () => svg });
    const page = await browser.newPage();
    try {
      await page.goto(server.url);
      await page.waitForSelector("#pp-stage > svg#d", { state: "attached", timeout: 5000 });
    } finally {
      await page.close();
      await server.close();
    }
  });
});
