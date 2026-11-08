// Eval tests for the CLI area (docs/evals/cli.md). They drive bin/pele-preview,
// not the modules behind it, so any of those can be regrown. Keep them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";

const bin = new URL("../../bin/pele-preview", import.meta.url).pathname;
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;
const diagram = fixture("flow.mmd");
const stylesheet = fixture("theme.css");
const tempDir = () => mkdtempSync(join(tmpdir(), "pele-preview-eval-"));

// A PATH whose open and xdg-open do nothing, so a run that wrongly starts a
// preview can't open a real browser.
const quietEnv = (() => {
  const dir = tempDir();
  for (const name of ["open", "xdg-open"]) {
    writeFileSync(join(dir, name), "#!/bin/sh\nexit 0\n");
    chmodSync(join(dir, name), 0o755);
  }
  return { ...process.env, PATH: `${dir}:${process.env.PATH}` };
})();

// A server that started would keep running, so give up after a few seconds.
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", timeout: 5000, env: quietEnv });

const README_USAGE = (() => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const block = readme.match(/```\n(usage: pele-preview[^]*?)\n```/);
  assert.ok(block, "README has a usage block");
  return block[1];
})();

// --- End-to-end -------------------------------------------------------------

test("CLI-E2E-001 -h and --help print usage to stdout and exit 0", () => {
  // @spec CLI-E2E-001
  for (const args of [["-h"], ["--help"], [diagram, "-h"], [diagram, stylesheet, "--help", "-o", "x.svg"]]) {
    const result = run(...args);
    assert.equal(result.status, 0, args.join(" "));
    assert.match(result.stdout, /^usage: pele-preview /);
    assert.equal(result.stderr, "");
  }
});

test("CLI-E2E-002 no diagram prints usage to stderr and exits 2", () => {
  // @spec CLI-E2E-002
  for (const args of [[], ["-n"], ["--scheme", "dark"]]) {
    const result = run(...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, /^usage: pele-preview /);
  }
});

test("CLI-E2E-003 a path that isn't an existing file prints no such file and exits 2", () => {
  // @spec CLI-E2E-003
  for (const [args, path] of [
    [["missing.mmd"], "missing.mmd"],
    [[diagram, "missing.css"], "missing.css"],
    [[diagram, "-c", "missing.css"], "missing.css"],
    [[fixture("")], fixture("")], // a directory
  ]) {
    const result = run(...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stderr, `no such file: ${path}\n`);
  }
});

test("CLI-E2E-004 an unknown option is named, followed by usage, and exits 2", () => {
  // @spec CLI-E2E-004
  for (const option of ["--bogus", "-z", "--theme"]) {
    const result = run(diagram, option);
    assert.equal(result.status, 2, option);
    assert.ok(result.stderr.includes(option), result.stderr);
    assert.match(result.stderr, /\n\nusage: pele-preview /);
  }
});

test("CLI-E2E-005 an option without its value is named and exits 2", () => {
  // @spec CLI-E2E-005
  for (const option of ["-c", "--css", "-o", "--output", "--scheme"]) {
    const result = run(diagram, option);
    assert.equal(result.status, 2, option);
    assert.ok(result.stderr.includes(option), result.stderr);
  }
});

test("CLI-E2E-006 an extra argument is named, followed by usage, and exits 2", () => {
  // @spec CLI-E2E-006
  for (const args of [[diagram, stylesheet, "extra"], [diagram, stylesheet, "-c", stylesheet]]) {
    const result = run(...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, new RegExp(`^unexpected argument: ${args[2] === "extra" ? "extra" : stylesheet}\n\nusage: pele-preview `));
  }
});

test("CLI-E2E-007 the stylesheet as positional, -c or --css is the same", () => {
  // @spec CLI-E2E-007
  const exported = (...args) => {
    const out = join(tempDir(), "out.svg");
    const result = run(diagram, ...args, "-o", out);
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(out, "utf8");
  };
  const positional = exported(stylesheet);
  assert.match(positional, /<style>/);
  assert.equal(exported("-c", stylesheet), positional);
  assert.equal(exported("--css", stylesheet), positional);
});

test("CLI-E2E-008 a --scheme other than auto, light or dark exits 2", () => {
  // @spec CLI-E2E-008
  for (const value of ["blue", "Dark", ""]) {
    const result = run(diagram, "--scheme", value);
    assert.equal(result.status, 2, value);
    assert.equal(result.stderr, `--scheme must be one of auto, light, dark, got: ${value}\n`);
  }
});

test("CLI-E2E-009 --palette is reported as an unknown option and exits 2", () => {
  // @spec CLI-E2E-009
  for (const args of [[diagram, "-n", "--palette", "paper"], [diagram, stylesheet, "--palette", "x", "-o", "x.svg"]]) {
    const result = run(...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, /--palette/);
    assert.match(result.stderr, /\n\nusage: pele-preview /);
  }
});

test("CLI-E2E-010 --font and --font-size are reported as unknown options and exit 2", () => {
  // @spec CLI-E2E-010
  for (const [option, value] of [["--font", "Georgia"], ["--font-size", "18"]]) {
    const result = run(diagram, "-n", option, value);
    assert.equal(result.status, 2, option);
    assert.ok(result.stderr.includes(option), result.stderr);
    assert.match(result.stderr, /\n\nusage: pele-preview /);
  }
});

// --- Invariants -------------------------------------------------------------

// A command line with at least one thing wrong with it, and optionally -o, so
// that a run that wrongly went ahead would write a file or start a server.
const flaw = fc.oneof(
  fc.constant({ replaceDiagram: "missing.mmd" }),
  fc.constantFrom("--bogus", "-z", "--palettes").map((option) => ({ extra: [option] })),
  fc.string({ minLength: 1 }).filter((s) => !s.startsWith("-")).map((s) => ({ extra: [stylesheet, s] })),
  fc.string().filter((s) => !["auto", "light", "dark"].includes(s) && !s.startsWith("-"))
    .map((s) => ({ extra: ["--scheme", s] })),
  fc.constantFrom("-c", "-o", "--scheme", "-p").map((option) => ({ trailing: option })),
);

const badCommandLine = fc.tuple(flaw, fc.boolean(), fc.constantFrom("auto", "light", "dark"))
  .map(([{ replaceDiagram, extra = [], trailing }, withOutput, scheme]) => {
    const dir = tempDir();
    const args = [replaceDiagram ?? diagram, "-n", "--scheme", scheme, ...extra];
    if (withOutput) args.push("-o", join(dir, "out.svg"));
    if (trailing) args.push(trailing);
    return { args, dir };
  });

test("CLI-INV-001 invalid arguments exit 2, write nothing and start no server", () => {
  // @spec CLI-INV-001
  fc.assert(fc.property(badCommandLine, ({ args, dir }) => {
    const result = run(...args);
    assert.equal(result.status, 2, `${JSON.stringify(args)}\n${result.stderr}`);
    assert.deepEqual(readdirSync(dir), []);
  }), { numRuns: 30 });
});

test("CLI-INV-002 invalid arguments print nothing to stdout", () => {
  // @spec CLI-INV-002
  fc.assert(fc.property(badCommandLine, ({ args }) => {
    assert.equal(run(...args).stdout, "");
  }), { numRuns: 30 });
});

test("CLI-INV-004 the README never mentions --palette or data-pele-scheme", () => {
  // @spec CLI-INV-004
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.equal(readme.match(/--palette|data-pele-scheme/g), null);
});

test("CLI-INV-005 the README never mentions --font or --font-size", () => {
  // @spec CLI-INV-005
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.equal(readme.match(/--font\b(?!-family|-mono)|--font-size/g), null);
});

test("CLI-INV-003 the usage text is the README's", () => {
  // @spec CLI-INV-003
  assert.equal(run("--help").stdout, `${README_USAGE}\n`);
  assert.equal(run().stderr, `${README_USAGE}\n`);
});
