// Eval tests for the EXPORT area (docs/evals/export.md). They drive the CLI,
// not the modules behind it, so any of those can be regrown. Keep them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { chromium } from "@playwright/test";
import { render, PeleError } from "pele";

const bin = new URL("../../bin/pele-preview", import.meta.url).pathname;
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });
const tempDir = () => mkdtempSync(join(tmpdir(), "pele-preview-eval-"));

function tempFile(name, contents) {
  const path = join(tempDir(), name);
  writeFileSync(path, contents);
  return path;
}

// Exports the flow fixture with `css` (text) and returns the SVG written.
function exportWith(css, ...args) {
  const out = join(tempDir(), "out.svg");
  const result = run(fixture("flow.mmd"), tempFile("style.css", css), ...args, "-o", out);
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(out, "utf8");
}

const hasXmllint = (() => {
  try { execFileSync("xmllint", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();
const needsXmllint = { skip: !hasXmllint && "xmllint not installed" };

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

// --- Contracts --------------------------------------------------------------

test("EXPORT-CON-001 the stylesheet is the root svg's first child, in CDATA", () => {
  // @spec EXPORT-CON-001
  const svg = exportWith(".pele { --pele-accent: red; }");
  assert.match(svg, /^<svg\b[^>]*><style><!\[CDATA\[/);
});

test("EXPORT-CON-002 pele renders a root svg with no style element", () => {
  // @spec EXPORT-CON-002
  const { svg } = render(readFileSync(fixture("flow.mmd"), "utf8"));
  assert.match(svg, /^<svg\b/);
  assert.doesNotMatch(svg, /<style\b/);
});

test("EXPORT-CON-003 pele reports a syntax error's line and column", () => {
  // @spec EXPORT-CON-003
  assert.throws(() => render(readFileSync(fixture("broken.mmd"), "utf8")),
    (e) => e instanceof PeleError && e.line === 2 && e.column === 9);
});

// --- End-to-end -------------------------------------------------------------

test("EXPORT-E2E-001 -o writes the rendered diagram with the stylesheet embedded", { ...needsXmllint }, () => {
  // @spec EXPORT-E2E-001
  const css = readFileSync(fixture("theme.css"), "utf8");
  const svg = exportWith(css);
  assert.match(svg, /Mermaid text/);
  assert.equal(styleText(svg).trim(), css.trim());
});

test("EXPORT-E2E-002 a successful export prints wrote <FILE> and exits 0", () => {
  // @spec EXPORT-E2E-002
  const out = join(tempDir(), "out.svg");
  const result = run(fixture("flow.mmd"), "-o", out);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `wrote ${out}\n`);
});

test("EXPORT-E2E-003 with no stylesheet the file is exactly pele's svg", () => {
  // @spec EXPORT-E2E-003
  const out = join(tempDir(), "out.svg");
  assert.equal(run(fixture("flow.mmd"), "-o", out).status, 0);
  assert.equal(readFileSync(out, "utf8"), render(readFileSync(fixture("flow.mmd"), "utf8")).svg);

  // A stylesheet with nothing but whitespace counts as none.
  assert.equal(exportWith(" \n\t\n"), readFileSync(out, "utf8"));
});

// Which of a light or dark rule a browser applies to the exported svg, when the
// viewer's own setting is `viewer`.
const SCHEMED = [
  ".pele { --probe: none; }",
  "@media (prefers-color-scheme: dark) { .pele { --probe: dark; } }",
  "@media screen and (prefers-color-scheme:light) { .pele { --probe: light; } }",
  // Media feature values are case-insensitive, so these count too.
  ".pele { --shout: none; }",
  "@media (PREFERS-COLOR-SCHEME: Dark) { .pele { --shout: dark; } }",
  "@media ( prefers-color-scheme : LIGHT ) { .pele { --shout: light; } }",
].join("\n");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function probe(svg, viewer) {
  const page = await browser.newPage({ colorScheme: viewer });
  try {
    await page.setContent(svg);
    const [plain, shout] = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector("svg"));
      return ["--probe", "--shout"].map((name) => style.getPropertyValue(name).trim());
    });
    assert.equal(shout, plain, "upper-case conditions behave like lower-case ones");
    return plain;
  } finally {
    await page.close();
  }
}

test("EXPORT-E2E-004 --scheme dark applies dark rules and never light ones", async () => {
  // @spec EXPORT-E2E-004
  const svg = exportWith(SCHEMED, "--scheme", "dark");
  assert.equal(await probe(svg, "light"), "dark");
  assert.equal(await probe(svg, "dark"), "dark");
});

test("EXPORT-E2E-005 --scheme light applies light rules and never dark ones", async () => {
  // @spec EXPORT-E2E-005
  const svg = exportWith(SCHEMED, "--scheme", "light");
  assert.equal(await probe(svg, "light"), "light");
  assert.equal(await probe(svg, "dark"), "light");
});

test("EXPORT-E2E-006 --scheme auto, or none, embeds the stylesheet unchanged", { ...needsXmllint }, async () => {
  // @spec EXPORT-E2E-006
  for (const args of [[], ["--scheme", "auto"]]) {
    const svg = exportWith(SCHEMED, ...args);
    assert.equal(styleText(svg).trim(), SCHEMED);
    assert.equal(await probe(svg, "light"), "light");
    assert.equal(await probe(svg, "dark"), "dark");
  }
});

test("EXPORT-E2E-007 a syntax error prints DIAGRAM:LINE:COLUMN and exits 1", () => {
  // @spec EXPORT-E2E-007
  const result = run(fixture("broken.mmd"), "-o", join(tempDir(), "out.svg"));
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`^${fixture("broken.mmd")}:2:9: Parse error`));
});

test("EXPORT-E2E-008 an error with no position prints DIAGRAM: MESSAGE and exits 1", () => {
  // @spec EXPORT-E2E-008
  const diagram = tempFile("d.mmd", "not a diagram");
  const result = run(diagram, "-o", join(tempDir(), "out.svg"));
  assert.equal(result.status, 1);
  assert.equal(result.stderr, `${diagram}: No diagram type detected for the given text.\n`);
});

test("EXPORT-E2E-009 a failed render neither creates nor changes the output file", () => {
  // @spec EXPORT-E2E-009
  const fresh = join(tempDir(), "out.svg");
  assert.equal(run(fixture("broken.mmd"), "-o", fresh).status, 1);
  assert.equal(existsSync(fresh), false);

  const existing = tempFile("out.svg", "previous");
  assert.equal(run(fixture("broken.mmd"), "-o", existing).status, 1);
  assert.equal(readFileSync(existing, "utf8"), "previous");
});

test("EXPORT-E2E-010 an output path that can't be written prints the error and exits 1", () => {
  // @spec EXPORT-E2E-010
  const out = join(tempDir(), "missing-dir", "out.svg");
  const result = run(fixture("flow.mmd"), "-o", out);
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`ENOENT.*${out}`));
});

// --- Invariants (properties, run through the CLI) ---------------------------

test("EXPORT-INV-001 export never changes the files it reads", () => {
  // @spec EXPORT-INV-001
  fc.assert(fc.property(cssText(QUERY), fc.constantFrom("auto", "light", "dark"), (css, scheme) => {
    const diagram = tempFile("d.mmd", readFileSync(fixture("flow.mmd")));
    const stylesheet = tempFile("s.css", css);
    const before = [readFileSync(diagram), readFileSync(stylesheet)];
    assert.equal(run(diagram, stylesheet, "--scheme", scheme, "-o", join(tempDir(), "o.svg")).status, 0);
    assert.deepEqual([readFileSync(diagram), readFileSync(stylesheet)], before);
  }), RUNS);
});

test("EXPORT-INV-002 the svg is well-formed XML whatever the stylesheet holds", { ...needsXmllint }, () => {
  // @spec EXPORT-INV-002
  fc.assert(fc.property(cssText(), (css) => {
    assert.doesNotThrow(() => checkWellFormed(exportWith(css)));
  }), RUNS);
});

test("EXPORT-INV-003 the style element reads back as the stylesheet", { ...needsXmllint }, () => {
  // @spec EXPORT-INV-003
  fc.assert(fc.property(cssText(), (css) => {
    assert.equal(styleText(exportWith(css)).trim(), css.trim());
  }), RUNS);
});

test("EXPORT-INV-004 a fixed scheme leaves no prefers-color-scheme condition", { ...needsXmllint }, () => {
  // @spec EXPORT-INV-004
  fc.assert(fc.property(cssText(QUERY, QUERY), fc.constantFrom("light", "dark"), (css, scheme) => {
    assert.doesNotMatch(styleText(exportWith(css, "--scheme", scheme)), /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i);
  }), RUNS);
});

test("EXPORT-INV-006 export only inserts the style element into pele's svg", () => {
  // @spec EXPORT-INV-006
  // EXPORT-CON-001 fixes where the stylesheet goes: first child of the root,
  // in a CDATA section. Take it out and pele's own svg must remain.
  const pele = render(readFileSync(fixture("flow.mmd"), "utf8")).svg;
  fc.assert(fc.property(cssText(QUERY), fc.constantFrom("auto", "light", "dark"), (css, scheme) => {
    const svg = exportWith(css, "--scheme", scheme);
    assert.equal(svg.replace(/<style><!\[CDATA\[[^]*?\]\]><\/style>/, ""), pele);
  }), RUNS);
});

test("EXPORT-INV-005 a fixed scheme changes only the prefers-color-scheme conditions", { ...needsXmllint }, () => {
  // @spec EXPORT-INV-005
  // Plain text between conditions must come through untouched; each condition
  // may become any parenthesized condition.
  const plain = fc.array(fc.oneof(fc.string({ unit: "grapheme" }), XML_HAZARDS), { maxLength: 4 })
    .map((parts) => parts.join("").replace(/[()]/g, ""));
  const pieces = fc.array(fc.tuple(plain, QUERY), { minLength: 1, maxLength: 5 });
  fc.assert(fc.property(pieces, plain, fc.constantFrom("light", "dark"), (pairs, tail, scheme) => {
    const css = `.pele{}${pairs.map(([text, query]) => text + query).join("")}${tail}`;
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shape = new RegExp(`^\\s*${escape(".pele{}")}${pairs.map(([text]) => `${escape(text)}\\(.*?\\)`).join("")}${escape(tail)}\\s*$`, "s");
    assert.match(styleText(exportWith(css, "--scheme", scheme)), shape);
  }), RUNS);
});
