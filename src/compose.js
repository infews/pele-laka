import { readFileSync } from "node:fs";
import { render, PeleError } from "pele";

// Renders a diagram with pele and embeds `css` inside the SVG, so the file
// carries its own styling wherever it is opened.
export function compose(mmd, css = "", { fontFamily, fontSize } = {}) {
  const options = {};
  if (fontFamily) options.fontFamily = fontFamily;
  if (fontSize) options.fontSize = fontSize;

  const { svg } = render(mmd, options);
  return css.trim() ? embed(svg, css) : svg;
}

export function readAndCompose({ diagram, stylesheet, fontFamily, fontSize }) {
  const css = stylesheet ? readFileSync(stylesheet, "utf8") : "";
  return compose(readFileSync(diagram, "utf8"), css, { fontFamily, fontSize });
}

export function describeError(error, file) {
  if (!(error instanceof PeleError)) return error.message;
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
