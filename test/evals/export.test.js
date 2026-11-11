// Eval tests for the EXPORT area (docs/evals/export.md). They drive the CLI,
// not the modules behind it, so any of those can be regrown. Keep them.
import { spawnSync, execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { chromium } from "playwright";
import { render, PeleError } from "pele";

const bin = new URL("../../bin/pele-laka", import.meta.url).pathname;
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;
const tempDir = () => mkdtempSync(join(tmpdir(), "pele-laka-eval-"));

// Runs the CLI with CHROME_PATH set to `chrome`, or unset when it's undefined.
function runWithChrome(chrome, ...args) {
  const env = { ...process.env };
  delete env.CHROME_PATH;
  if (chrome !== undefined) env.CHROME_PATH = chrome;
  return spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", env });
}

// Tests that only check the SVG run without Chrome, so they stay fast and don't
// need it installed. The PNG tests use the developer's CHROME_PATH, if set, or
// Chrome's standard install location.
const NO_CHROME = join(tmpdir(), "pele-laka-no-chrome", "chrome");
const run = (...args) => runWithChrome(NO_CHROME, ...args);
const runChrome = (...args) => runWithChrome(process.env.CHROME_PATH, ...args);

// A stand-in for Chrome: a script that fails, after touching `marker` if given.
function brokenChrome(marker) {
  const path = join(tempDir(), "chrome");
  writeFileSync(path, `#!/bin/sh\n${marker ? `touch '${marker}'\n` : ""}echo "chrome broke" >&2\nexit 1\n`);
  chmodSync(path, 0o755);
  return path;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isPng = (path) => readFileSync(path).subarray(0, 8).equals(PNG_SIGNATURE);
const svgSize = (svg) => ["width", "height"].map((name) => Number(svg.match(new RegExp(`^<svg\\b[^>]*\\b${name}="([\\d.]+)"`))[1]));

// Nodes pure red in light, pure blue in dark, so a PNG shows which was drawn.
const RED_BLUE = ".pele rect { fill: #ff0000; }\n@media (prefers-color-scheme: dark) { .pele rect { fill: #0000ff; } }";

function tempFile(name, contents) {
  const path = join(tempDir(), name);
  writeFileSync(path, contents);
  return path;
}

// Exports the flow fixture with `css` (text) into a fresh directory and
// returns the SVG written.
function exportWith(css, ...args) {
  const out = tempDir();
  const result = run("export", "-c", tempFile("style.css", css), ...args, "-o", out, fixture("flow.mmd"));
  expect(result.status).withContext(result.stderr).toBe(0);
  return readFileSync(join(out, "flow.svg"), "utf8");
}

// A copy of a fixture diagram, alone in a fresh directory, under `name`.
const diagramCopy = (fixtureName, name = fixtureName) => tempFile(name, readFileSync(fixture(fixtureName)));

const hasXmllint = (() => {
  try { execFileSync("xmllint", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();
const needsXmllint = () => { if (!hasXmllint) pending("xmllint not installed"); };

// Throws unless `svg` is well-formed XML.
const checkWellFormed = (svg) =>
  execFileSync("xmllint", ["--noout", "-"], { input: svg, stdio: ["pipe", "ignore", "pipe"] });

// The text of the root <svg>'s <style> element, as an XML parser reads it.
const styleText = (svg) =>
  execFileSync("xmllint", ["--xpath", 'string(/*/*[local-name()="style"])', "-"], { input: svg, encoding: "utf8" });

// Stylesheet text with the characters most likely to break XML mixed in.
const XML_HAZARDS = fc.constantFrom("]]>", "]]", "<", ">", "&", "<![CDATA[", "</style>", '"', "'", "\n", "\t");
const QUERY = fc.tuple(fc.constantFrom("light", "dark", "Light", "DARK"), fc.constantFrom("", " ", "  "))
  .map(([mode, pad]) => `(${pad}prefers-color-scheme${pad}:${pad}${mode}${pad})`);
const cssText = (...extra) => fc.array(fc.oneof(fc.string({ unit: "grapheme" }), XML_HAZARDS, ...extra), { minLength: 1, maxLength: 10 })
  .map((parts) => `.pele{}${parts.join("")}`);
const RUNS = { numRuns: 20 };

// Light and dark rules, so a browser shows which one applies to the exported
// svg. Media feature values are case-insensitive, so the --shout pair counts too.
const SCHEMED = [
  ".pele { --probe: none; }",
  "@media (prefers-color-scheme: dark) { .pele { --probe: dark; } }",
  "@media screen and (prefers-color-scheme:light) { .pele { --probe: light; } }",
  ".pele { --shout: none; }",
  "@media (PREFERS-COLOR-SCHEME: Dark) { .pele { --shout: dark; } }",
  "@media ( prefers-color-scheme : LIGHT ) { .pele { --shout: light; } }",
].join("\n");

describe("EXPORT", () => {
  describe("contracts", () => {
    it("EXPORT-CON-001 the stylesheet is the root svg's first child, in CDATA", () => {
      // @spec EXPORT-CON-001
      expect(exportWith(".pele { --pele-accent: red; }")).toMatch(/^<svg\b[^>]*><style><!\[CDATA\[/);
    });

    it("EXPORT-CON-002 pele renders a root svg with no style element", () => {
      // @spec EXPORT-CON-002
      const { svg } = render(readFileSync(fixture("flow.mmd"), "utf8"));
      expect(svg).toMatch(/^<svg\b/);
      expect(svg).not.toMatch(/<style\b/);
    });

    it("EXPORT-CON-003 pele reports a syntax error's line and column", () => {
      // @spec EXPORT-CON-003
      expect(() => render(readFileSync(fixture("broken.mmd"), "utf8")))
        .toThrowMatching((e) => e instanceof PeleError && e.line === 2 && e.column === 9);
    });

    it("EXPORT-CON-004 Chrome runs from CHROME_PATH when set, otherwise from its standard place", () => {
      // @spec EXPORT-CON-004
      const marker = join(tempDir(), "ran");
      const out = tempDir();
      expect(runWithChrome(brokenChrome(marker), "export", "-o", out, fixture("flow.mmd")).status).toBe(1);
      expect(existsSync(marker)).withContext("the CHROME_PATH script ran").toBe(true);

      const standard = tempDir();
      const result = runWithChrome(undefined, "export", "-o", standard, fixture("flow.mmd"));
      expect(result.status).withContext(result.stderr).toBe(0);
      expect(isPng(join(standard, "flow.png"))).withContext("Chrome from its standard place drew the PNG").toBe(true);
    });
  });

  describe("end-to-end", () => {
    let browser;
    beforeAll(async () => { browser = await chromium.launch(); });
    afterAll(async () => { await browser?.close(); });

    // Which of a light or dark rule in SCHEMED the browser applies to `svg`,
    // when the viewer's own setting is `viewer`.
    async function probe(svg, viewer) {
      const page = await browser.newPage({ colorScheme: viewer });
      try {
        await page.setContent(svg);
        const [plain, shout] = await page.evaluate(() => {
          const style = getComputedStyle(document.querySelector("svg"));
          return ["--probe", "--shout"].map((name) => style.getPropertyValue(name).trim());
        });
        expect(shout).withContext("upper-case conditions behave like lower-case ones").toBe(plain);
        return plain;
      } finally {
        await page.close();
      }
    }

    // The size of the PNG at `path`, its corners' alpha, and how many of its
    // opaque pixels are pure red and pure blue.
    async function pngPixels(path) {
      const page = await browser.newPage();
      try {
        return await page.evaluate(async (src) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          const alpha = (x, y) => data[(y * canvas.width + x) * 4 + 3];
          let opaque = 0, red = 0, blue = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] !== 255) continue;
            opaque++;
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) red++;
            if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255) blue++;
          }
          const [w, h] = [canvas.width - 1, canvas.height - 1];
          return { width: canvas.width, height: canvas.height, corners: [alpha(0, 0), alpha(w, 0), alpha(0, h), alpha(w, h)], opaque, red, blue };
        }, `data:image/png;base64,${readFileSync(path).toString("base64")}`);
      } finally {
        await page.close();
      }
    }

    // Exports the flow fixture with Chrome and `args`; returns the PNG's pixels.
    async function exportPng(...args) {
      const out = tempDir();
      const result = runChrome("export", ...args, "-o", out, fixture("flow.mmd"));
      expect(result.status).withContext(result.stderr).toBe(0);
      return pngPixels(join(out, "flow.png"));
    }

    it("EXPORT-E2E-001 export writes NAME.svg next to the diagram, with the stylesheet embedded", () => {
      // @spec EXPORT-E2E-001
      needsXmllint();
      const css = readFileSync(fixture("theme.css"), "utf8");
      const diagram = diagramCopy("flow.mmd", "my.flow.mmd");
      const result = run("export", "-c", fixture("theme.css"), diagram);
      expect(result.status).withContext(result.stderr).toBe(0);
      const dir = dirname(diagram);
      expect(readdirSync(dir).sort()).toEqual(["my.flow.mmd", "my.flow.svg"]);
      const svg = readFileSync(join(dir, "my.flow.svg"), "utf8");
      expect(svg).toMatch(/Mermaid text/);
      expect(styleText(svg).trim()).toBe(css.trim());
    });

    it("EXPORT-E2E-002 a successful export prints wrote <path> for the SVG, then the PNG, and exits 0", () => {
      // @spec EXPORT-E2E-002
      const out = tempDir();
      const result = runChrome("export", "-o", out, fixture("flow.mmd"));
      expect(result.status).withContext(result.stderr).toBe(0);
      expect(result.stdout).toBe(`wrote ${join(out, "flow.svg")}\nwrote ${join(out, "flow.png")}\n`);

      const diagram = diagramCopy("flow.mmd");
      const dir = dirname(diagram);
      const beside = runChrome("export", diagram);
      expect(beside.status).withContext(beside.stderr).toBe(0);
      expect(beside.stdout).toBe(`wrote ${join(dir, "flow.svg")}\nwrote ${join(dir, "flow.png")}\n`);
    });

    it("EXPORT-E2E-003 with no stylesheet the file is exactly pele's svg", () => {
      // @spec EXPORT-E2E-003
      const out = tempDir();
      expect(run("export", "-o", out, fixture("flow.mmd")).status).toBe(0);
      const written = readFileSync(join(out, "flow.svg"), "utf8");
      expect(written).toBe(render(readFileSync(fixture("flow.mmd"), "utf8")).svg);

      // A stylesheet with nothing but whitespace counts as none.
      expect(exportWith(" \n\t\n")).toBe(written);
    });

    it("EXPORT-E2E-004 --scheme dark applies dark rules and never light ones", async () => {
      // @spec EXPORT-E2E-004
      const svg = exportWith(SCHEMED, "--scheme", "dark");
      expect(await probe(svg, "light")).toBe("dark");
      expect(await probe(svg, "dark")).toBe("dark");
    });

    it("EXPORT-E2E-005 --scheme light applies light rules and never dark ones", async () => {
      // @spec EXPORT-E2E-005
      const svg = exportWith(SCHEMED, "--scheme", "light");
      expect(await probe(svg, "light")).toBe("light");
      expect(await probe(svg, "dark")).toBe("light");
    });

    it("EXPORT-E2E-006 --scheme auto, or none, embeds the stylesheet unchanged", async () => {
      // @spec EXPORT-E2E-006
      needsXmllint();
      for (const args of [[], ["--scheme", "auto"]]) {
        const svg = exportWith(SCHEMED, ...args);
        expect(styleText(svg).trim()).toBe(SCHEMED);
        expect(await probe(svg, "light")).toBe("light");
        expect(await probe(svg, "dark")).toBe("dark");
      }
    });

    it("EXPORT-E2E-007 a syntax error prints DIAGRAM:LINE:COLUMN and exits 1", () => {
      // @spec EXPORT-E2E-007
      const result = run("export", "-o", tempDir(), fixture("broken.mmd"));
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`^${fixture("broken.mmd")}:2:9: Parse error`));
    });

    it("EXPORT-E2E-008 an error with no position prints DIAGRAM: MESSAGE and exits 1", () => {
      // @spec EXPORT-E2E-008
      const diagram = tempFile("d.mmd", "not a diagram");
      const result = run("export", "-o", tempDir(), diagram);
      expect(result.status).toBe(1);
      expect(result.stderr).toBe(`${diagram}: No diagram type detected for the given text.\n`);
    });

    it("EXPORT-E2E-009 a failed render neither creates nor changes the SVG or the PNG", () => {
      // @spec EXPORT-E2E-009
      const fresh = tempDir();
      expect(runChrome("export", "-o", fresh, fixture("broken.mmd")).status).toBe(1);
      expect(readdirSync(fresh)).toEqual([]);

      const beside = diagramCopy("broken.mmd");
      expect(runChrome("export", beside).status).toBe(1);
      expect(readdirSync(dirname(beside))).toEqual(["broken.mmd"]);

      const existing = tempDir();
      for (const name of ["broken.svg", "broken.png"]) writeFileSync(join(existing, name), "previous");
      expect(runChrome("export", "-o", existing, fixture("broken.mmd")).status).toBe(1);
      for (const name of ["broken.svg", "broken.png"]) expect(readFileSync(join(existing, name), "utf8")).withContext(name).toBe("previous");
    });

    it("EXPORT-E2E-010 an SVG that can't be written prints the error, writes no PNG and exits 1", () => {
      // @spec EXPORT-E2E-010
      const out = tempDir();
      mkdirSync(join(out, "flow.svg")); // a directory where the SVG would go
      const result = runChrome("export", "-o", out, fixture("flow.mmd"));
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`EISDIR.*${join(out, "flow.svg")}`));
      expect(readdirSync(out)).toEqual(["flow.svg"]);
    });

    it("EXPORT-E2E-012 -o DIR writes NAME.svg and NAME.png in DIR instead", () => {
      // @spec EXPORT-E2E-012
      const diagram = diagramCopy("flow.mmd");
      const out = tempDir();
      const result = runChrome("export", "-o", out, diagram);
      expect(result.status).withContext(result.stderr).toBe(0);
      expect(readdirSync(out).sort()).toEqual(["flow.png", "flow.svg"]);
      expect(isPng(join(out, "flow.png"))).toBe(true);
      expect(readFileSync(join(out, "flow.svg"), "utf8")).toBe(render(readFileSync(diagram, "utf8")).svg);
      expect(readdirSync(dirname(diagram))).toEqual(["flow.mmd"]);
    });

    it("EXPORT-E2E-013 a -o that isn't an existing directory prints no such directory and exits 2", () => {
      // @spec EXPORT-E2E-013
      for (const dir of [join(tempDir(), "missing"), tempFile("plain", "a file")]) {
        const result = run("export", "-o", dir, fixture("flow.mmd"));
        expect(result.status).withContext(dir).toBe(2);
        expect(result.stderr).toBe(`no such directory: ${dir}\n`);
      }
    });

    it("EXPORT-E2E-014 an existing NAME.svg or NAME.png is replaced", () => {
      // @spec EXPORT-E2E-014
      const diagram = diagramCopy("flow.mmd");
      const svg = join(dirname(diagram), "flow.svg");
      const png = join(dirname(diagram), "flow.png");
      writeFileSync(svg, "previous");
      writeFileSync(png, "previous");
      const result = runChrome("export", diagram);
      expect(result.status).withContext(result.stderr).toBe(0);
      expect(readFileSync(svg, "utf8")).toBe(render(readFileSync(diagram, "utf8")).svg);
      expect(isPng(png)).toBe(true);
    });

    it("EXPORT-E2E-015 an SVG or PNG path that is the diagram's or the stylesheet's prints would overwrite and exits 2", () => {
      // @spec EXPORT-E2E-015
      const svgDiagram = diagramCopy("flow.mmd", "flow.svg");
      const dir = tempDir();
      const sheetBeside = join(dir, "flow.svg");
      writeFileSync(sheetBeside, ".pele {}");
      const diagramBeside = join(dir, "flow.mmd");
      writeFileSync(diagramBeside, readFileSync(fixture("flow.mmd")));
      const out = tempDir();
      const sheetInOut = join(out, "flow.svg");
      writeFileSync(sheetInOut, ".pele {}");
      const pngDiagram = diagramCopy("flow.mmd", "flow.png");
      const pngDir = tempDir();
      const pngSheet = join(pngDir, "flow.png");
      writeFileSync(pngSheet, ".pele {}");
      const pngSheetDiagram = join(pngDir, "flow.mmd");
      writeFileSync(pngSheetDiagram, readFileSync(fixture("flow.mmd")));

      for (const [args, path] of [
        [[svgDiagram], svgDiagram],
        [["-c", sheetBeside, diagramBeside], sheetBeside],
        [["-c", sheetInOut, "-o", out, fixture("flow.mmd")], sheetInOut],
        [[pngDiagram], pngDiagram],
        [["-c", pngSheet, pngSheetDiagram], pngSheet],
      ]) {
        const before = readFileSync(path, "utf8");
        const result = run("export", ...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).toBe(`would overwrite ${path}\n`);
        expect(readFileSync(path, "utf8")).toBe(before);
      }
    });

    it("EXPORT-E2E-016 after the SVG, NAME.png is the SVG drawn by Chrome at twice its size", async () => {
      // @spec EXPORT-E2E-016
      const out = tempDir();
      const result = runChrome("export", "-c", tempFile("s.css", RED_BLUE), "-o", out, fixture("flow.mmd"));
      expect(result.status).withContext(result.stderr).toBe(0);
      const [width, height] = svgSize(readFileSync(join(out, "flow.svg"), "utf8"));
      const png = await pngPixels(join(out, "flow.png"));
      expect([png.width, png.height]).toEqual([Math.round(2 * width), Math.round(2 * height)]);
      expect(png.red).withContext("the stylesheet's node fill was drawn").toBeGreaterThan(0);
    });

    it("EXPORT-E2E-017 the PNG is transparent wherever the SVG draws nothing", async () => {
      // @spec EXPORT-E2E-017
      const png = await exportPng();
      expect(png.corners).toEqual([0, 0, 0, 0]);
      expect(png.opaque).withContext("the diagram itself is drawn").toBeGreaterThan(0);
    });

    it("EXPORT-E2E-018 --scheme dark draws the PNG dark; light, auto or none draws it light", async () => {
      // @spec EXPORT-E2E-018
      const sheet = tempFile("s.css", RED_BLUE);
      const dark = await exportPng("-c", sheet, "--scheme", "dark");
      expect(dark.blue).withContext("dark: blue").toBeGreaterThan(0);
      expect(dark.red).withContext("dark: no red").toBe(0);
      for (const args of [["--scheme", "light"], ["--scheme", "auto"], []]) {
        const light = await exportPng("-c", sheet, ...args);
        expect(light.red).withContext(`${args.join(" ") || "no --scheme"}: red`).toBeGreaterThan(0);
        expect(light.blue).withContext(`${args.join(" ") || "no --scheme"}: no blue`).toBe(0);
      }
    });

    it("EXPORT-E2E-019 with no Chrome, export writes the SVG, says the PNG was skipped and exits 0", () => {
      // @spec EXPORT-E2E-019
      const out = tempDir();
      const result = run("export", "-o", out, fixture("flow.mmd"));
      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`wrote ${join(out, "flow.svg")}\n`);
      expect(result.stderr).toBe(`skipped ${join(out, "flow.png")}: PNG export needs Google Chrome\n`);
      expect(readdirSync(out)).toEqual(["flow.svg"]);
    });

    it("EXPORT-E2E-020 when Chrome fails, export keeps the SVG, leaves an old PNG alone, prints the error and exits 1", () => {
      // @spec EXPORT-E2E-020
      const fresh = tempDir();
      const result = runWithChrome(brokenChrome(), "export", "-o", fresh, fixture("flow.mmd"));
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`^${join(fresh, "flow.png")}: .*chrome broke`, "s"));
      expect(readdirSync(fresh)).toEqual(["flow.svg"]);
      expect(readFileSync(join(fresh, "flow.svg"), "utf8")).toBe(render(readFileSync(fixture("flow.mmd"), "utf8")).svg);

      const existing = tempDir();
      writeFileSync(join(existing, "flow.png"), "previous");
      expect(runWithChrome(brokenChrome(), "export", "-o", existing, fixture("flow.mmd")).status).toBe(1);
      expect(readFileSync(join(existing, "flow.png"), "utf8")).toBe("previous");
    });
  });

  describe("invariants (properties, run through the CLI)", () => {
    it("EXPORT-INV-001 export never changes the files it reads", () => {
      // @spec EXPORT-INV-001
      fc.assert(fc.property(cssText(QUERY), fc.constantFrom("auto", "light", "dark"), (css, scheme) => {
        const diagram = tempFile("d.mmd", readFileSync(fixture("flow.mmd")));
        const stylesheet = tempFile("s.css", css);
        const before = [readFileSync(diagram), readFileSync(stylesheet)];
        expect(run("export", "-c", stylesheet, "--scheme", scheme, "-o", tempDir(), diagram).status).toBe(0);
        expect([readFileSync(diagram), readFileSync(stylesheet)]).toEqual(before);
      }), RUNS);
    });

    it("EXPORT-INV-002 the svg is well-formed XML whatever the stylesheet holds", () => {
      // @spec EXPORT-INV-002
      needsXmllint();
      fc.assert(fc.property(cssText(), (css) => {
        expect(() => checkWellFormed(exportWith(css))).not.toThrow();
      }), RUNS);
    });

    it("EXPORT-INV-003 the style element reads back as the stylesheet", () => {
      // @spec EXPORT-INV-003
      needsXmllint();
      fc.assert(fc.property(cssText(), (css) => {
        expect(styleText(exportWith(css)).trim()).toBe(css.trim());
      }), RUNS);
    });

    it("EXPORT-INV-004 a fixed scheme leaves no prefers-color-scheme condition", () => {
      // @spec EXPORT-INV-004
      needsXmllint();
      fc.assert(fc.property(cssText(QUERY, QUERY), fc.constantFrom("light", "dark"), (css, scheme) => {
        expect(styleText(exportWith(css, "--scheme", scheme))).not.toMatch(/\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i);
      }), RUNS);
    });

    it("EXPORT-INV-005 a fixed scheme changes only the prefers-color-scheme conditions", () => {
      // @spec EXPORT-INV-005
      needsXmllint();
      // Plain text between conditions must come through untouched; each condition
      // may become any parenthesized condition.
      const plain = fc.array(fc.oneof(fc.string({ unit: "grapheme" }), XML_HAZARDS), { maxLength: 4 })
        .map((parts) => parts.join("").replace(/[()]/g, ""));
      const pieces = fc.array(fc.tuple(plain, QUERY), { minLength: 1, maxLength: 5 });
      fc.assert(fc.property(pieces, plain, fc.constantFrom("light", "dark"), (pairs, tail, scheme) => {
        const css = `.pele{}${pairs.map(([text, query]) => text + query).join("")}${tail}`;
        const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const shape = new RegExp(`^\\s*${escape(".pele{}")}${pairs.map(([text]) => `${escape(text)}\\(.*?\\)`).join("")}${escape(tail)}\\s*$`, "s");
        expect(styleText(exportWith(css, "--scheme", scheme))).toMatch(shape);
      }), RUNS);
    });

    it("EXPORT-INV-006 export only inserts the style element into pele's svg", () => {
      // @spec EXPORT-INV-006
      // EXPORT-CON-001 fixes where the stylesheet goes: first child of the root,
      // in a CDATA section. Take it out and pele's own svg must remain.
      const pele = render(readFileSync(fixture("flow.mmd"), "utf8")).svg;
      fc.assert(fc.property(cssText(QUERY), fc.constantFrom("auto", "light", "dark"), (css, scheme) => {
        const svg = exportWith(css, "--scheme", scheme);
        expect(svg.replace(/<style><!\[CDATA\[[^]*?\]\]><\/style>/, "")).toBe(pele);
      }), RUNS);
    });
  });
});
