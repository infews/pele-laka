// @subsystem Compose
import { readFileSync } from "node:fs";
import { render, PeleError } from "pele";

export const SCHEMES = ["auto", "light", "dark"];

// Renders a diagram with pele and embeds `css` inside the SVG, so the file
// carries its own styling wherever it is opened. `scheme` other than "auto"
// fixes the CSS to light or dark (see applyScheme).
export function compose(mmd, css = "", { fontFamily, fontSize, scheme = "auto" } = {}) {
  return styled(draw(mmd, { fontFamily, fontSize }), css, scheme);
}

export function readAndCompose({ diagram, stylesheet, fontFamily, fontSize, scheme }) {
  const { mmd, css } = read(diagram, stylesheet);
  return compose(mmd, css, { fontFamily, fontSize, scheme });
}

// A page cannot force `prefers-color-scheme`, so a fixed scheme is applied by
// rewriting the CSS: each `(prefers-color-scheme: X)` becomes a condition that
// is always true when X is the chosen scheme and never true otherwise.
const ALWAYS = "(min-width: 0px)";
const NEVER = "(not (min-width: 0px))";
const COLOR_SCHEME_QUERY = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/gi;

export function applyScheme(css, scheme) {
  if (scheme === "auto") return css;
  return css.replace(COLOR_SCHEME_QUERY, (_, wanted) => (wanted.toLowerCase() === scheme ? ALWAYS : NEVER));
}

function read(diagram, stylesheet) {
  return {
    mmd: readFileSync(diagram, "utf8"),
    css: stylesheet ? readFileSync(stylesheet, "utf8") : "",
  };
}

function draw(mmd, { fontFamily, fontSize }) {
  const options = {};
  if (fontFamily) options.fontFamily = fontFamily;
  if (fontSize) options.fontSize = fontSize;
  return render(mmd, options).svg;
}

function styled(svg, css, scheme) {
  return css.trim() ? embed(svg, applyScheme(css, scheme)) : svg;
}

export function describeError(error, file) {
  if (!(error instanceof PeleError)) return error instanceof Error ? (error.message || String(error)) : String(error);
  if (error.line > 0) return `${file}:${error.line}:${error.column}: ${error.message}`;
  return `${file}: ${error.message}`;
}

// The root tag ends at the first `>` outside a quoted attribute value.
const ROOT_TAG = /^<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/;

// CDATA keeps `>`, `&` and `<` in CSS from breaking the XML. A literal `]]>`
// would close the section early, so it is split across two sections.
export function embed(svg, css) {
  const root = svg.match(ROOT_TAG);
  if (!root) throw new Error("unexpected pele output: no root <svg> tag");
  const body = css.replaceAll("]]>", "]]]]><![CDATA[>");
  const rootTagEnd = root[0].length;
  return `${svg.slice(0, rootTagEnd)}<style><![CDATA[\n${body}\n]]></style>${svg.slice(rootTagEnd)}`;
}
