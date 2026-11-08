// Internal tests of the Arguments subsystem. A redesign may rewrite or delete
// them; the CLI evals (test/evals/cli.test.js) are what must keep passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { parse, UsageError, HelpRequested } from "../src/cli.js";

const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;
const css = new URL("./fixtures/theme.css", import.meta.url).pathname;

test("diagram only: preview defaults", () => {
  assert.deepEqual(parse([flow]), {
    diagram: flow, stylesheet: null, output: null, port: 0,
    open: true, browserApp: null, fontFamily: null, fontSize: null, scheme: "auto",
  });
});

test("stylesheet as second positional or -c", () => {
  assert.equal(parse([flow, css]).stylesheet, css);
  assert.equal(parse([flow, "-c", css]).stylesheet, css);
  assert.equal(parse([flow, "--css", css]).stylesheet, css);
});

test("-c plus a second positional is an error", () => {
  assert.throws(() => parse([flow, css, "-c", css]), (e) => e instanceof UsageError && /unexpected argument/.test(e.message));
});

test("-o resolves the output path; the file need not exist", () => {
  assert.equal(parse([flow, "-o", "out.svg"]).output, resolve("out.svg"));
});

test("all flags", () => {
  const o = parse([flow, "-p", "4000", "-n", "-B", "Google Chrome", "--font", "Georgia", "--font-size", "18"]);
  assert.equal(o.port, 4000);
  assert.equal(o.open, false);
  assert.equal(o.browserApp, "Google Chrome");
  assert.equal(o.fontFamily, "Georgia");
  assert.equal(o.fontSize, 18);
});

test("non-numeric port is a usage error", () => {
  assert.throws(() => parse([flow, "-p", "abc"]), UsageError);
});

test("missing diagram argument prints usage", () => {
  assert.throws(() => parse([]), (e) => e instanceof UsageError && /^usage: pele-preview/.test(e.message));
});

test("nonexistent files are usage errors", () => {
  assert.throws(() => parse(["nope.mmd"]), /no such file: nope\.mmd/);
  assert.throws(() => parse([flow, "nope.css"]), /no such file: nope\.css/);
});

test("unknown flags are usage errors", () => {
  assert.throws(() => parse([flow, "--theme", "dark"]), UsageError);
});

test("-h asks for help even without a diagram", () => {
  assert.throws(() => parse(["-h"]), HelpRequested);
});

test("port must be 0-65535", () => {
  assert.throws(() => parse([flow, "-p", "70000"]), (e) => e instanceof UsageError && /--port/.test(e.message));
  assert.equal(parse([flow, "-p", "65535"]).port, 65535);
  assert.equal(parse([flow, "-p", "0"]).port, 0);
});

test("font size must be at least 1", () => {
  assert.throws(() => parse([flow, "--font-size", "0"]), (e) => e instanceof UsageError && /--font-size/.test(e.message));
  assert.equal(parse([flow, "--font-size", "1"]).fontSize, 1);
});

test("--scheme picks auto, light or dark", () => {
  assert.equal(parse([flow, "--scheme", "dark"]).scheme, "dark");
  assert.equal(parse([flow, "--scheme", "light"]).scheme, "light");
  assert.throws(() => parse([flow, "--scheme", "blue"]), (e) => e instanceof UsageError && /--scheme must be one of auto, light, dark/.test(e.message));
});

test("--palette is not an option", () => {
  assert.throws(() => parse([flow, "--palette", "paper"]), (e) => e instanceof UsageError && /--palette/.test(e.message));
});
