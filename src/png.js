// @subsystem PNG
// Finds Google Chrome and has it draw an SVG as a PNG.
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { chromium } from "playwright-core";

// The SVG at twice its size on a transparent background, as PNG bytes, drawn
// by the Chrome at `chrome`. The page is light, and the SVG keeps its full
// width however wide it is.
export async function drawPng(svg, chrome) {
  const browser = await chromium.launch({ executablePath: chrome });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2, colorScheme: "light" });
    await page.setContent(`<!doctype html><style>body { margin: 0 } body > svg { display: block; max-width: none !important }</style>${svg}`);
    const root = page.locator("body > svg");
    const { width, height } = await root.boundingBox();
    await page.setViewportSize({ width: Math.ceil(width), height: Math.ceil(height) });
    await page.evaluate(() => globalThis.document.fonts.ready);
    return await root.screenshot({ omitBackground: true, type: "png" });
  } finally {
    await browser.close();
  }
}

export const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// The path of the Chrome to run, or null when there is none: CHROME_PATH when
// set, otherwise Chrome's standard install location for the platform.
export function findChrome({ env = process.env, platform = process.platform } = {}) {
  if (env.CHROME_PATH) return executable(env.CHROME_PATH);
  if (platform === "darwin") return executable(MAC_CHROME);
  if (platform === "linux") return onPath("google-chrome", env.PATH);
  return null;
}

function onPath(name, path = "") {
  for (const dir of path.split(delimiter).filter(Boolean)) {
    const found = executable(join(dir, name));
    if (found) return found;
  }
  return null;
}

function executable(path) {
  try {
    if (!statSync(path).isFile()) return null;
    accessSync(path, constants.X_OK);
    return path;
  } catch {
    return null;
  }
}
