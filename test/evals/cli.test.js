// Eval tests for the CLI area (docs/evals/cli.md). They drive bin/pele-preview,
// not the modules behind it, so any of those can be regrown. Keep them.
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
  if (!block) throw new Error("README has no usage block");
  return block[1];
})();

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

describe("CLI", () => {
  describe("end-to-end", () => {
    it("CLI-E2E-001 -h and --help print usage to stdout and exit 0", () => {
      // @spec CLI-E2E-001
      for (const args of [["-h"], ["--help"], [diagram, "-h"], [diagram, stylesheet, "--help", "-o", "x.svg"]]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(0);
        expect(result.stdout).toMatch(/^usage: pele-preview /);
        expect(result.stderr).toBe("");
      }
    });

    it("CLI-E2E-002 no diagram prints usage to stderr and exits 2", () => {
      // @spec CLI-E2E-002
      for (const args of [[], ["-n"], ["--scheme", "dark"]]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).toMatch(/^usage: pele-preview /);
      }
    });

    it("CLI-E2E-003 a path that isn't an existing file prints no such file and exits 2", () => {
      // @spec CLI-E2E-003
      for (const [args, path] of [
        [["missing.mmd"], "missing.mmd"],
        [[diagram, "missing.css"], "missing.css"],
        [[diagram, "-c", "missing.css"], "missing.css"],
        [[fixture("")], fixture("")], // a directory
      ]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).toBe(`no such file: ${path}\n`);
      }
    });

    it("CLI-E2E-004 an unknown option is named, followed by usage, and exits 2", () => {
      // @spec CLI-E2E-004
      for (const option of ["--bogus", "-z", "--theme"]) {
        const result = run(diagram, option);
        expect(result.status).withContext(option).toBe(2);
        expect(result.stderr).toContain(option);
        expect(result.stderr).toMatch(/\n\nusage: pele-preview /);
      }
    });

    it("CLI-E2E-005 an option without its value is named and exits 2", () => {
      // @spec CLI-E2E-005
      for (const option of ["-c", "--css", "-o", "--output", "--scheme"]) {
        const result = run(diagram, option);
        expect(result.status).withContext(option).toBe(2);
        expect(result.stderr).toContain(option);
      }
    });

    it("CLI-E2E-006 an extra argument is named, followed by usage, and exits 2", () => {
      // @spec CLI-E2E-006
      for (const args of [[diagram, stylesheet, "extra"], [diagram, stylesheet, "-c", stylesheet]]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).toMatch(new RegExp(`^unexpected argument: ${args[2] === "extra" ? "extra" : stylesheet}\n\nusage: pele-preview `));
      }
    });

    it("CLI-E2E-007 the stylesheet as positional, -c or --css is the same", () => {
      // @spec CLI-E2E-007
      const exported = (...args) => {
        const out = join(tempDir(), "out.svg");
        const result = run(diagram, ...args, "-o", out);
        expect(result.status).withContext(result.stderr).toBe(0);
        return readFileSync(out, "utf8");
      };
      const positional = exported(stylesheet);
      expect(positional).toMatch(/<style>/);
      expect(exported("-c", stylesheet)).toBe(positional);
      expect(exported("--css", stylesheet)).toBe(positional);
    });

    it("CLI-E2E-008 a --scheme other than auto, light or dark exits 2", () => {
      // @spec CLI-E2E-008
      for (const value of ["blue", "Dark", ""]) {
        const result = run(diagram, "--scheme", value);
        expect(result.status).withContext(value).toBe(2);
        expect(result.stderr).toBe(`--scheme must be one of auto, light, dark, got: ${value}\n`);
      }
    });
  });

  describe("invariants", () => {
    it("CLI-INV-001 invalid arguments exit 2, write nothing and start no server", () => {
      // @spec CLI-INV-001
      fc.assert(fc.property(badCommandLine, ({ args, dir }) => {
        const result = run(...args);
        expect(result.status).withContext(`${JSON.stringify(args)}\n${result.stderr}`).toBe(2);
        expect(readdirSync(dir)).toEqual([]);
      }), { numRuns: 30 });
    });

    it("CLI-INV-002 invalid arguments print nothing to stdout", () => {
      // @spec CLI-INV-002
      fc.assert(fc.property(badCommandLine, ({ args }) => {
        expect(run(...args).stdout).toBe("");
      }), { numRuns: 30 });
    });

    it("CLI-INV-003 the usage text is the README's", () => {
      // @spec CLI-INV-003
      expect(run("--help").stdout).toBe(`${README_USAGE}\n`);
      expect(run().stderr).toBe(`${README_USAGE}\n`);
    });
  });
});
