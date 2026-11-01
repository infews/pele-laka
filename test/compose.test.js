import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
