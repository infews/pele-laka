// Internal property tests of the Arguments subsystem: the whole-number rule
// behind -p and --font-size. A redesign may rewrite or delete them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { parse, UsageError } from "../src/cli.js";

const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;

const usageError = (pattern) => (e) => e instanceof UsageError && pattern.test(e.message);

test("-p accepts exactly the whole numbers 0 to 65535", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 65535 }), (n) => {
    assert.equal(parse([flow, "-p", String(n)]).port, n);
  }));
  fc.assert(fc.property(fc.integer({ min: 65536, max: 10 ** 9 }), (n) => {
    assert.throws(() => parse([flow, "-p", String(n)]), usageError(new RegExp(`^--port must be between 0 and 65535, got: ${n}$`)));
  }));
});

test("--font-size accepts whole numbers from 1", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 10 ** 6 }), (n) => {
    assert.equal(parse([flow, "--font-size", String(n)]).fontSize, n);
  }));
  assert.throws(() => parse([flow, "--font-size", "0"]), usageError(/^--font-size must be at least 1, got: 0$/));
});

// Text with something other than digits in it, anywhere: before, after or
// between them. Leading "-" is left out, since parseArgs reads it as a flag.
const notWholeNumber = fc.tuple(fc.stringMatching(/^\d{0,3}$/), fc.string({ minLength: 1 }), fc.stringMatching(/^\d{0,3}$/))
  .map(([before, middle, after]) => before + middle + after)
  .filter((text) => !/^\d+$/.test(text) && !text.startsWith("-"));

test("anything but digits is not a whole number", () => {
  fc.assert(fc.property(notWholeNumber, fc.constantFrom("-p", "--font-size"), (text, flag) => {
    const name = flag === "-p" ? "--port" : "--font-size";
    assert.throws(() => parse([flow, flag, text]), (e) =>
      e instanceof UsageError && e.message === `${name} must be a whole number, got: ${text}`);
  }));
  for (const text of ["1a", "a1", "1.5", " 1", "1 "]) assert.throws(() => parse([flow, "-p", text]), UsageError, text);
});
