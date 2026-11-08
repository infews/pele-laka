import { test } from "node:test";
import fc from "fast-check";
import { applyScheme, setPalette, PALETTE_NAME } from "../src/compose.js";

test("a fixed scheme leaves no prefers-color-scheme query in the css", () => {
  const query = fc.tuple(fc.constantFrom("light", "dark", "LIGHT", "Dark"), fc.constantFrom("", " ", "  "))
    .map(([mode, pad]) => `(${pad}prefers-color-scheme${pad}:${pad}${mode}${pad})`);
  const css = fc.array(fc.oneof(query, fc.string()), { maxLength: 8 }).map((parts) => parts.join(" "));
  fc.assert(fc.property(css, fc.constantFrom("light", "dark"), (text, scheme) =>
    !/\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i.test(applyScheme(text, scheme))));
});

test("setPalette only ever adds one safe attribute to the root tag", () => {
  fc.assert(fc.property(fc.string(), (name) => {
    try {
      const out = setPalette("<svg><g/></svg>", name);
      return name === "" || (PALETTE_NAME.test(name) && out === `<svg data-pele-scheme="${name}"><g/></svg>`);
    } catch {
      return !PALETTE_NAME.test(name);
    }
  }));
});
