// Eval tests for the CLI area (docs/evals/cli.md). They drive bin/pele-laka,
// not the modules behind it, so any of those can be regrown. Keep them.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, readdirSync, writeFileSync, chmodSync, accessSync, constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";

const bin = new URL("../../bin/pele-laka", import.meta.url).pathname;
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname;
const diagram = fixture("flow.mmd");
const stylesheet = fixture("theme.css");
const tempDir = () => mkdtempSync(join(tmpdir(), "pele-laka-eval-"));

// A PATH whose open and xdg-open do nothing, so a run that wrongly starts a
// preview can't open a real browser, and no Chrome, so exports write only the SVG.
const quietEnv = (() => {
  const dir = tempDir();
  for (const name of ["open", "xdg-open"]) {
    writeFileSync(join(dir, name), "#!/bin/sh\nexit 0\n");
    chmodSync(join(dir, name), 0o755);
  }
  return { ...process.env, PATH: `${dir}:${process.env.PATH}`, CHROME_PATH: join(dir, "no-chrome") };
})();

// A server that started would keep running, so give up after a few seconds.
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", timeout: 5000, env: quietEnv });

const readmeUsage = () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const block = readme.match(/```\n(usage: pele-laka[^]*?)\n```/);
  if (!block) throw new Error("README has no usage block");
  return block[1];
};

// A project folder holding a copy of the diagram and an empty out/, so a run
// that wrongly went ahead would leave a file behind.
function project() {
  const dir = tempDir();
  const copy = join(dir, "flow.mmd");
  copyFileSync(diagram, copy);
  mkdirSync(join(dir, "out"));
  return { dir, diagram: copy, out: join(dir, "out") };
}

const notACommand = (s) => !["preview", "export", "-h", "--help"].includes(s);

// What can be wrong with a command line, given the command and the project.
const flaw = fc.oneof(
  fc.constant(() => ({ replaceDiagram: "missing.mmd" })),
  fc.constantFrom("--bogus", "-z", "--palettes").map((option) => () => ({ extra: [option] })),
  fc.string({ minLength: 1 }).filter((s) => !s.startsWith("-")).map((s) => () => ({ after: [s] })),
  fc.string().filter((s) => !["auto", "light", "dark"].includes(s) && !s.startsWith("-"))
    .map((s) => () => ({ extra: ["--scheme", s] })),
  fc.constantFrom("-c", "--scheme").map((option) => () => ({ trailing: option })),
  fc.string({ minLength: 1 }).filter(notACommand).map((s) => () => ({ replaceCommand: s })),
  fc.constant(({ diagram }) => ({ replaceCommand: diagram })),
  fc.nat(2).map((i) => (_, command) => (command === "export"
    ? { extra: [["-p", "8080"], ["-n"], ["-B", "Safari"]][i] }
    : { extra: ["-o", "."] })),
  fc.constant((_, command) => ({ trailing: command === "export" ? "-o" : "-p" })),
  fc.constant(({ dir }, command) => (command === "export"
    ? { extra: ["-o", join(dir, "missing")] }
    : { replaceDiagram: "missing.mmd" })),
);

// A command line with at least one thing wrong with it. Export sometimes also
// gets a valid -o, and preview always gets -n, so a run that wrongly went ahead
// writes a file or starts a server without opening a browser.
const badCommandLine = fc.tuple(flaw, fc.constantFrom("preview", "export"), fc.boolean(), fc.constantFrom("auto", "light", "dark"))
  .map(([makeFlaw, command, withOutput, scheme]) => {
    const where = project();
    const { replaceCommand, replaceDiagram, extra = [], after = [], trailing } = makeFlaw(where, command);
    const options = command === "preview" ? ["-n"] : withOutput && !extra.includes("-o") ? ["-o", where.out] : [];
    const args = [replaceCommand ?? command, "--scheme", scheme, ...options, ...extra,
      replaceDiagram ?? where.diagram, ...after];
    if (trailing) args.push(trailing);
    return { args, where };
  });

describe("CLI", () => {
  describe("contracts", () => {
    it("CLI-CON-001 the package installs one command, pele-laka", () => {
      // @spec CLI-CON-001
      const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
      expect(pkg.bin).toEqual({ "pele-laka": "bin/pele-laka" });
      expect(() => accessSync(new URL("../../bin/pele-laka", import.meta.url), constants.X_OK))
        .withContext("bin/pele-laka is executable").not.toThrow();
    });
  });

  describe("end-to-end", () => {
    it("CLI-E2E-001 -h and --help print usage to stdout and exit 0", () => {
      // @spec CLI-E2E-001
      const { diagram, out } = project();
      for (const args of [["-h"], ["--help"], ["export", "-h"], ["preview", diagram, "--help"],
        ["export", "-c", stylesheet, "--help", "-o", out, diagram]]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(0);
        expect(result.stdout).toMatch(/^usage: pele-laka /);
        expect(result.stderr).toBe("");
      }
    });

    it("CLI-E2E-002 no arguments, or a command with no diagram, prints usage to stderr and exits 2", () => {
      // @spec CLI-E2E-002
      for (const args of [[], ["preview"], ["export"], ["preview", "-n"], ["export", "--scheme", "dark"]]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).toMatch(/^usage: pele-laka /);
      }
    });

    it("CLI-E2E-003 a path that isn't an existing file prints no such file and exits 2", () => {
      // @spec CLI-E2E-003
      const { diagram, out } = project();
      for (const command of [["preview", "-n"], ["export", "-o", out]]) {
        for (const [args, path] of [
          [["missing.mmd"], "missing.mmd"],
          [["-c", "missing.css", diagram], "missing.css"],
          [["--css", "missing.css", diagram], "missing.css"],
          [[fixture("")], fixture("")], // a directory
        ]) {
          const result = run(...command, ...args);
          expect(result.status).withContext([...command, ...args].join(" ")).toBe(2);
          expect(result.stderr).toBe(`no such file: ${path}\n`);
        }
      }
    });

    it("CLI-E2E-004 an option the command doesn't take is named, followed by usage, and exits 2", () => {
      // @spec CLI-E2E-004
      const { diagram, out } = project();
      for (const [command, option, ...value] of [
        ["export", "--bogus"], ["export", "-z"], ["export", "--theme"],
        ["export", "-p", "8080"], ["export", "--port", "8080"], ["export", "-n"], ["export", "--no-open"],
        ["export", "-B", "Safari"], ["export", "--browser", "Safari"],
        ["preview", "--bogus"], ["preview", "-o", out], ["preview", "--output", out],
      ]) {
        const args = [command, option, ...value, diagram];
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).withContext(args.join(" ")).toContain(option);
        expect(result.stderr).withContext(args.join(" ")).toMatch(/\n\nusage: pele-laka /);
      }
      expect(readdirSync(out)).toEqual([]);
    });

    it("CLI-E2E-005 an option without its value is named and exits 2", () => {
      // @spec CLI-E2E-005
      const { diagram } = project();
      for (const [command, option] of [
        ["export", "-c"], ["export", "--css"], ["export", "-o"], ["export", "--output"], ["export", "--scheme"],
        ["preview", "-c"], ["preview", "--scheme"], ["preview", "-p"], ["preview", "--port"], ["preview", "-B"],
      ]) {
        const result = run(command, diagram, option);
        expect(result.status).withContext(`${command} ${option}`).toBe(2);
        expect(result.stderr).withContext(`${command} ${option}`).toContain(option);
      }
    });

    it("CLI-E2E-006 a second diagram is named, followed by usage, and exits 2", () => {
      // @spec CLI-E2E-006
      const { diagram, out } = project();
      for (const [args, extra] of [
        [["export", "-o", out, diagram, "extra"], "extra"],
        [["export", "-o", out, diagram, stylesheet], stylesheet],
        [["preview", "-n", diagram, diagram], diagram],
      ]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).toMatch(new RegExp(`^unexpected argument: ${extra}\n\nusage: pele-laka `));
      }
    });

    it("CLI-E2E-007 -c and --css are the same", () => {
      // @spec CLI-E2E-007
      const { diagram } = project();
      const exported = (option) => {
        const out = tempDir();
        const result = run("export", option, stylesheet, "-o", out, diagram);
        expect(result.status).withContext(result.stderr).toBe(0);
        return readFileSync(join(out, "flow.svg"), "utf8");
      };
      const short = exported("-c");
      expect(short).toMatch(/<style>/);
      expect(exported("--css")).toBe(short);
    });

    it("CLI-E2E-008 a --scheme other than auto, light or dark exits 2", () => {
      // @spec CLI-E2E-008
      const { diagram, out } = project();
      for (const command of [["preview", "-n"], ["export", "-o", out]]) {
        for (const value of ["blue", "Dark", ""]) {
          const result = run(...command, "--scheme", value, diagram);
          expect(result.status).withContext(`${command[0]} ${value}`).toBe(2);
          expect(result.stderr).toBe(`--scheme must be one of auto, light, dark, got: ${value}\n`);
        }
      }
    });

    it("CLI-E2E-011 the usage text begins usage: pele-laka", () => {
      // @spec CLI-E2E-011
      const result = run("--help");
      expect(result.stdout.startsWith("usage: pele-laka ")).withContext(result.stdout || result.stderr).toBe(true);
    });

    it("CLI-E2E-012 a first argument that isn't a command is named, followed by usage, and exits 2", () => {
      // @spec CLI-E2E-012
      const { diagram } = project();
      for (const args of [["render", diagram], [diagram], ["Export", diagram], ["-n", "preview", diagram]]) {
        const result = run(...args);
        expect(result.status).withContext(args.join(" ")).toBe(2);
        expect(result.stderr).withContext(args.join(" ")).toBe(`unknown command: ${args[0]}\n\n${readmeUsage()}\n`);
      }
    });
  });

  describe("invariants", () => {
    it("CLI-INV-001 invalid arguments exit 2, write nothing and start no server", () => {
      // @spec CLI-INV-001
      fc.assert(fc.property(badCommandLine, ({ args, where }) => {
        const result = run(...args);
        expect(result.status).withContext(`${JSON.stringify(args)}\n${result.stderr}`).toBe(2);
        expect(readdirSync(where.dir).sort()).toEqual(["flow.mmd", "out"]);
        expect(readdirSync(where.out)).toEqual([]);
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
      const usage = readmeUsage();
      expect(run("--help").stdout).toBe(`${usage}\n`);
      expect(run().stderr).toBe(`${usage}\n`);
    });
  });
});
