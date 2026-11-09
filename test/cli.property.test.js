// Internal property tests of the Arguments subsystem: the whole-number rule
// behind -p. A redesign may rewrite or delete them.
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
      expect(parse([flow, "-p", String(n)]).port).toBe(n);
    }));
    fc.assert(fc.property(fc.integer({ min: 65536, max: 10 ** 9 }), (n) => {
      expect(() => parse([flow, "-p", String(n)])).toThrowError(UsageError, `--port must be between 0 and 65535, got: ${n}`);
    }));
  });

  it("rejects anything but digits as not a whole number", () => {
    fc.assert(fc.property(notWholeNumber, (text) => {
      expect(() => parse([flow, "-p", text])).toThrowError(UsageError, `--port must be a whole number, got: ${text}`);
    }));
    for (const text of ["1a", "a1", "1.5", " 1", "1 "]) expect(() => parse([flow, "-p", text])).withContext(text).toThrowError(UsageError);
  });
});
