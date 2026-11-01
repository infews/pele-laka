import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { render, PeleError } from "pele";
import { compose, readAndCompose, describeError, embed } from "../src/compose.js";

const FLOW = "flowchart LR\n  A[Mermaid text] --> B[SVG]";
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

const hasXmllint = (() => {
  try { execFileSync("xmllint", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();
const wellFormed = (xml) => execFileSync("xmllint", ["--noout", "-"], { input: xml, stdio: ["pipe", "ignore", "pipe"] });

test("without css, output is exactly pele's", () => {
  assert.equal(compose(FLOW, ""), render(FLOW).svg);
  assert.equal(compose(FLOW, "  \n"), render(FLOW).svg);
});

test("css becomes the first child of the root svg, in CDATA", () => {
  const svg = compose(FLOW, ".pele { --pele-accent: red; }");
  assert.match(svg, /^<svg [^>]*><style><!\[CDATA\[\n\.pele \{ --pele-accent: red; \}\n\]\]><\/style><g /);
});

test("css with XML-special characters stays well-formed", { skip: !hasXmllint && "xmllint not installed" }, () => {
  const css = ".pele-node > rect { fill: red; }\n/* a & b < c ]]> d */";
  const svg = compose(FLOW, css);
  assert.doesNotThrow(() => wellFormed(svg));
  assert.ok(svg.includes("]]]]><![CDATA[>"), "a literal ]]> is split so it cannot end the section");
});

test("font options reach pele", () => {
  assert.match(compose(FLOW, "", { fontFamily: "Georgia" }), /--pele-font,Georgia/);
  const width = (svg) => Number(svg.match(/width="([\d.]+)"/)[1]);
  assert.ok(width(compose(FLOW, "", { fontSize: 24 })) > width(compose(FLOW, "")));
});

test("invalid diagrams throw PeleError", () => {
  assert.throws(() => compose("flowchart LR\n  A --> (((", ""), PeleError);
});

test("readAndCompose reads both files", () => {
  const svg = readAndCompose({ diagram: fixture("flow.mmd"), stylesheet: fixture("theme.css") });
  assert.match(svg, /--pele-surface: #eae7e7/);
  assert.match(svg, /Mermaid text/);
});

test("readAndCompose works without a stylesheet", () => {
  const svg = readAndCompose({ diagram: fixture("flow.mmd"), stylesheet: null });
  assert.doesNotMatch(svg, /<style>/);
});

test("describeError gives file:line:column for syntax errors", () => {
  try { compose("flowchart LR\n  A --> (((", ""); }
  catch (e) { assert.match(describeError(e, "d.mmd"), /^d\.mmd:2:9: Parse error on line 2/); }
});

test("describeError omits position when pele has none", () => {
  try { compose("not a diagram", ""); }
  catch (e) { assert.equal(describeError(e, "d.mmd"), "d.mmd: No diagram type detected for the given text."); }
});

test("describeError passes other errors through", () => {
  assert.equal(describeError(new Error("EACCES: nope"), "d.mmd"), "EACCES: nope");
});

test("embed finds the root tag end even with > inside an attribute value", () => {
  assert.equal(embed(`<svg a="x>y" b='p>q'><g/></svg>`, "x{}"),
    `<svg a="x>y" b='p>q'><style><![CDATA[\nx{}\n]]></style><g/></svg>`);
});

test("embed rejects output with no root svg tag", () => {
  assert.throws(() => embed("<div></div>", "x{}"), /unexpected pele output: no root <svg> tag/);
});

test("describeError handles non-Error throws and empty messages", () => {
  assert.equal(describeError("boom", "d.mmd"), "boom");
  assert.ok(describeError(new Error(""), "d.mmd").length > 0);
});

// --- color schemes ---------------------------------------------------------

import { applyScheme, readAndComposeAll, SCHEMES } from "../src/compose.js";

const SCHEMED_CSS = [
  ".pele { --pele-bg: #fff; }",
  "@media (prefers-color-scheme: dark) { .pele { --pele-bg: #000; } }",
  "@media screen and (prefers-color-scheme:light) { .pele { --pele-line: red; } }",
].join("\n");

test("the schemes are auto, light and dark", () => {
  assert.deepEqual(SCHEMES, ["auto", "light", "dark"]);
});

test("auto leaves the css alone", () => {
  assert.equal(applyScheme(SCHEMED_CSS, "auto"), SCHEMED_CSS);
});

test("dark switches dark rules on and light rules off", () => {
  const css = applyScheme(SCHEMED_CSS, "dark");
  assert.match(css, /@media \(min-width: 0px\) \{ \.pele \{ --pele-bg: #000; \} \}/);
  assert.match(css, /@media screen and \(not \(min-width: 0px\)\) \{/);
  assert.doesNotMatch(css, /prefers-color-scheme/);
});

test("light is the mirror image", () => {
  const css = applyScheme(SCHEMED_CSS, "light");
  assert.match(css, /@media \(not \(min-width: 0px\)\) \{ \.pele \{ --pele-bg: #000; \} \}/);
  assert.match(css, /@media screen and \(min-width: 0px\) \{/);
});

test("compose applies the scheme option", () => {
  assert.match(compose(FLOW, SCHEMED_CSS, { scheme: "dark" }), /@media \(min-width: 0px\)/);
  assert.match(compose(FLOW, SCHEMED_CSS), /prefers-color-scheme: dark/);
});

test("readAndComposeAll gives one svg per scheme", () => {
  const all = readAndComposeAll({ diagram: fixture("flow.mmd"), stylesheet: fixture("theme.css") }).svgs;
  assert.deepEqual(Object.keys(all), SCHEMES);
  assert.match(all.auto, /prefers-color-scheme: dark/);
  assert.match(all.dark, /@media \(min-width: 0px\)/);
  assert.match(all.light, /@media \(not \(min-width: 0px\)\)/);
});

// --- palettes --------------------------------------------------------------

import { setPalette, palettesIn } from "../src/compose.js";

test("setPalette marks the root svg with data-pele-scheme", () => {
  const svg = setPalette(render(FLOW).svg, "paper");
  assert.match(svg, /^<svg data-pele-scheme="paper" xmlns=/);
});

test("setPalette with no palette changes nothing", () => {
  assert.equal(setPalette("<svg/>", null), "<svg/>");
});

test("setPalette refuses names that could break out of the attribute", () => {
  assert.throws(() => setPalette("<svg/>", 'a" onload="x'), /invalid palette name/);
});

test("palettesIn lists the data-pele-scheme names a stylesheet defines, once each, in order", () => {
  assert.deepEqual(palettesIn(readFileSync(fixture("palettes.css"), "utf8")), ["carbon", "paper", "moss"]);
  assert.deepEqual(palettesIn(".pele { --pele-bg: red; }"), []);
});

test("compose applies the palette option", () => {
  assert.match(compose(FLOW, "", { palette: "moss" }), /^<svg data-pele-scheme="moss"/);
});

test("readAndComposeAll also reports the stylesheet's palettes", () => {
  const { svgs, palettes } = readAndComposeAll({ diagram: fixture("flow.mmd"), stylesheet: fixture("palettes.css") });
  assert.deepEqual(Object.keys(svgs), SCHEMES);
  assert.deepEqual(palettes, ["carbon", "paper", "moss"]);
});
