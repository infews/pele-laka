// Internal property tests of the Arguments subsystem: the whole-number rule
// behind -p, and how export names its files. A redesign may rewrite or delete them.
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import fc from "fast-check";
import { parse, UsageError } from "../src/cli.js";

const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;

// Text with something other than digits in it, anywhere: before, after or
// between them. Leading "-" is left out, since parseArgs reads it as a flag.
const notWholeNumber = fc.tuple(fc.stringMatching(/^\d{0,3}$/), fc.string({ minLength: 1 }), fc.stringMatching(/^\d{0,3}$/))
  .map(([before, middle, after]) => before + middle + after)
  .filter((text) => !/^\d+$/.test(text) && !text.startsWith("-"));

describe("-p", () => {
  it("accepts exactly the whole numbers 0 to 65535", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 65535 }), (n) => {
      expect(parse(["preview", flow, "-p", String(n)]).port).toBe(n);
    }));
    fc.assert(fc.property(fc.integer({ min: 65536, max: 10 ** 9 }), (n) => {
      expect(() => parse(["preview", flow, "-p", String(n)])).toThrowError(UsageError, `--port must be between 0 and 65535, got: ${n}`);
    }));
  });

  it("rejects anything but digits as not a whole number", () => {
    fc.assert(fc.property(notWholeNumber, (text) => {
      expect(() => parse(["preview", flow, "-p", text])).toThrowError(UsageError, `--port must be a whole number, got: ${text}`);
    }));
    for (const text of ["1a", "a1", "1.5", " 1", "1 "]) expect(() => parse(["preview", flow, "-p", text])).withContext(text).toThrowError(UsageError);
  });
});

describe("export's files", () => {
  // Diagram names with dots, spaces and odd extensions, but no "/".
  const diagramName = fc.tuple(fc.stringMatching(/^[\w .-]{1,12}$/), fc.constantFrom(".mmd", ".mermaid", ".txt", ".x.mmd", ""))
    .map(([stem, ext]) => stem + ext)
    .filter((name) => ![".", ".."].includes(name) && !name.startsWith("-") && !/\.(svg|png)$/.test(name));

  it("are NAME.svg and NAME.png, side by side in one directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "pele-laka-names-"));
    fc.assert(fc.property(diagramName, fc.boolean(), (name, withOutput) => {
      const diagram = join(dir, name);
      copyFileSync(flow, diagram);
      const out = withOutput ? tmpdir() : dir;
      const { svg, png } = parse(["export", ...(withOutput ? ["-o", out] : []), diagram]);
      const stem = join(out, basename(name, extname(name)));
      expect([svg, png]).toEqual([`${stem}.svg`, `${stem}.png`]);
    }));
  });
});
