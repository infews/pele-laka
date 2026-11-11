// Internal tests of the PNG subsystem (src/png.js). A redesign may rewrite or
// delete them; the EXPORT evals are what must keep passing.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drawPng, findChrome, MAC_CHROME } from "../src/png.js";

const tempDir = () => mkdtempSync(join(tmpdir(), "pele-laka-png-"));

function file(dir, name, mode = 0o755) {
  const path = join(dir, name);
  writeFileSync(path, "#!/bin/sh\n");
  chmodSync(path, mode);
  return path;
}

describe("findChrome", () => {
  it("takes CHROME_PATH when it names an executable file, on any platform", () => {
    const chrome = file(tempDir(), "my-chrome");
    for (const platform of ["darwin", "linux", "win32"]) {
      expect(findChrome({ env: { CHROME_PATH: chrome }, platform })).withContext(platform).toBe(chrome);
    }
  });

  it("finds nothing when CHROME_PATH is missing, a directory or not executable", () => {
    const dir = tempDir();
    for (const path of [join(dir, "missing"), dir, file(dir, "plain", 0o644)]) {
      expect(findChrome({ env: { CHROME_PATH: path, PATH: "" }, platform: "linux" })).withContext(path).toBeNull();
    }
  });

  it("ignores an empty CHROME_PATH", () => {
    const bin = tempDir();
    const chrome = file(bin, "google-chrome");
    expect(findChrome({ env: { CHROME_PATH: "", PATH: bin }, platform: "linux" })).toBe(chrome);
  });

  it("looks for google-chrome on the PATH on Linux, first match wins", () => {
    const [empty, first, second] = [tempDir(), tempDir(), tempDir()];
    mkdirSync(join(empty, "google-chrome")); // a directory isn't Chrome
    const chrome = file(first, "google-chrome");
    file(second, "google-chrome");
    expect(findChrome({ env: { PATH: [empty, "", first, second].join(":") }, platform: "linux" })).toBe(chrome);
    expect(findChrome({ env: { PATH: empty }, platform: "linux" })).toBeNull();
    expect(findChrome({ env: {}, platform: "linux" })).toBeNull();
  });

  it("looks in /Applications on macOS, and not on the PATH", () => {
    const bin = tempDir();
    file(bin, "google-chrome");
    const found = findChrome({ env: { PATH: bin }, platform: "darwin" });
    expect(found).toBe(existsSync(MAC_CHROME) ? MAC_CHROME : null);
    expect(MAC_CHROME).toBe("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  });

  it("doesn't read an empty PATH entry as the current directory", () => {
    const here = process.cwd();
    const cwd = tempDir();
    file(cwd, "google-chrome");
    process.chdir(cwd);
    try {
      expect(findChrome({ env: { PATH: ":" }, platform: "linux" })).toBeNull();
    } finally {
      process.chdir(here);
    }
  });

  it("finds nothing on other platforms without CHROME_PATH", () => {
    const bin = tempDir();
    file(bin, "google-chrome");
    expect(findChrome({ env: { PATH: bin }, platform: "win32" })).toBeNull();
  });
});

describe("drawPng", () => {
  const chrome = findChrome();
  const needsChrome = () => { if (!chrome) pending("Google Chrome not installed"); };
  // A wide SVG with a red box in the middle and nothing at its edges.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="40" style="max-width:100%;height:auto"><rect x="700" y="10" width="100" height="20" fill="#ff0000"/></svg>';

  it("draws the SVG at twice its size, even wider than a window", async () => {
    needsChrome();
    const png = await drawPng(svg, chrome);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([3000, 80]);
  });

  it("names Chrome's own error when it can't start", async () => {
    const broken = file(tempDir(), "chrome");
    writeFileSync(broken, "#!/bin/sh\necho 'chrome broke' >&2\nexit 1\n");
    await expectAsync(drawPng(svg, broken)).toBeRejectedWithError(/chrome broke/);
  });
});
