// Internal property test of the Compose subsystem. A redesign may rewrite or
// delete it.
import fc from "fast-check";
import { applyScheme } from "../src/compose.js";

describe("applyScheme with a fixed scheme", () => {
  it("leaves no prefers-color-scheme query in the css", () => {
    const query = fc.tuple(fc.constantFrom("light", "dark", "LIGHT", "Dark"), fc.constantFrom("", " ", "  "))
      .map(([mode, pad]) => `(${pad}prefers-color-scheme${pad}:${pad}${mode}${pad})`);
    const css = fc.array(fc.oneof(query, fc.string()), { maxLength: 8 }).map((parts) => parts.join(" "));
    fc.assert(fc.property(css, fc.constantFrom("light", "dark"), (text, scheme) =>
      !/\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/i.test(applyScheme(text, scheme))));
  });
});
