// Internal tests of the Compose subsystem. A redesign may rewrite or delete
// them; the EXPORT evals (test/evals/export.test.js) are what must keep passing.
import { execFileSync } from "node:child_process";
import { render, PeleError } from "pele";
import { compose, readAndCompose, describeError, embed, applyScheme, SCHEMES } from "../src/compose.js";

const FLOW = "flowchart LR\n  A[Mermaid text] --> B[SVG]";
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

const hasXmllint = (() => {
  try { execFileSync("xmllint", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();
const wellFormed = (xml) => execFileSync("xmllint", ["--noout", "-"], { input: xml, stdio: ["pipe", "ignore", "pipe"] });

// The error `body` throws; fails the spec if it throws nothing.
function thrownBy(body) {
  try { body(); } catch (error) { return error; }
  throw new Error("expected an error");
}

describe("compose", () => {
  it("returns exactly pele's output without css", () => {
    expect(compose(FLOW)).toBe(render(FLOW).svg);
    expect(compose(FLOW, "")).toBe(render(FLOW).svg);
    expect(compose(FLOW, "  \n")).toBe(render(FLOW).svg);
  });

  it("makes the css the first child of the root svg, in CDATA", () => {
    expect(compose(FLOW, ".pele { --pele-accent: red; }"))
      .toMatch(/^<svg [^>]*><style><!\[CDATA\[\n\.pele \{ --pele-accent: red; \}\n\]\]><\/style><g /);
  });

  it("stays well-formed with XML-special characters in the css", () => {
    if (!hasXmllint) pending("xmllint not installed");
    const svg = compose(FLOW, ".pele-node > rect { fill: red; }\n/* a & b < c ]]> d */");
    expect(() => wellFormed(svg)).not.toThrow();
    expect(svg).withContext("a literal ]]> is split so it cannot end the section").toContain("]]]]><![CDATA[>");
  });

  it("throws PeleError for invalid diagrams", () => {
    expect(() => compose("flowchart LR\n  A --> (((", "")).toThrowError(PeleError);
  });

  it("applies the scheme option", () => {
    expect(compose(FLOW, SCHEMED_CSS, { scheme: "dark" })).toMatch(/@media \(min-width: 0px\)/);
    expect(compose(FLOW, SCHEMED_CSS)).toMatch(/prefers-color-scheme: dark/);
  });
});

describe("readAndCompose", () => {
  it("reads both files", () => {
    const svg = readAndCompose({ diagram: fixture("flow.mmd"), stylesheet: fixture("theme.css") });
    expect(svg).toMatch(/--pele-surface: #eae7e7/);
    expect(svg).toMatch(/Mermaid text/);
  });

  it("works without a stylesheet", () => {
    expect(readAndCompose({ diagram: fixture("flow.mmd"), stylesheet: null })).not.toMatch(/<style>/);
  });
});

describe("describeError", () => {
  it("gives file:line:column for syntax errors", () => {
    expect(describeError(thrownBy(() => compose("flowchart LR\n  A --> (((", "")), "d.mmd")).toMatch(/^d\.mmd:2:9: Parse error on line 2/);
  });

  it("omits the position when pele has none", () => {
    expect(describeError(thrownBy(() => compose("not a diagram", "")), "d.mmd")).toBe("d.mmd: No diagram type detected for the given text.");
  });

  it("passes other errors through", () => {
    expect(describeError(new Error("EACCES: nope"), "d.mmd")).toBe("EACCES: nope");
  });

  it("handles non-Error throws and empty messages", () => {
    expect(describeError("boom", "d.mmd")).toBe("boom");
    expect(describeError(new Error(""), "d.mmd").length).toBeGreaterThan(0);
  });
});

describe("embed", () => {
  it("finds the root tag's end even with > inside an attribute value", () => {
    expect(embed(`<svg a="x>y" b='p>q'><g/></svg>`, "x{}"))
      .toBe(`<svg a="x>y" b='p>q'><style><![CDATA[\nx{}\n]]></style><g/></svg>`);
  });

  it("rejects output with no root svg tag", () => {
    expect(() => embed("<div></div>", "x{}")).toThrowError(/unexpected pele output: no root <svg> tag/);
  });
});

const SCHEMED_CSS = [
  ".pele { --pele-bg: #fff; }",
  "@media (prefers-color-scheme: dark) { .pele { --pele-bg: #000; } }",
  "@media screen and (prefers-color-scheme:light) { .pele { --pele-line: red; } }",
].join("\n");

describe("applyScheme", () => {
  it("knows the schemes auto, light and dark", () => {
    expect(SCHEMES).toEqual(["auto", "light", "dark"]);
  });

  it("leaves the css alone for auto", () => {
    expect(applyScheme(SCHEMED_CSS, "auto")).toBe(SCHEMED_CSS);
  });

  it("switches dark rules on and light rules off for dark", () => {
    const css = applyScheme(SCHEMED_CSS, "dark");
    expect(css).toMatch(/@media \(min-width: 0px\) \{ \.pele \{ --pele-bg: #000; \} \}/);
    expect(css).toMatch(/@media screen and \(not \(min-width: 0px\)\) \{/);
    expect(css).not.toMatch(/prefers-color-scheme/);
  });

  it("does the mirror image for light", () => {
    const css = applyScheme(SCHEMED_CSS, "light");
    expect(css).toMatch(/@media \(not \(min-width: 0px\)\) \{ \.pele \{ --pele-bg: #000; \} \}/);
    expect(css).toMatch(/@media screen and \(min-width: 0px\) \{/);
  });
});
