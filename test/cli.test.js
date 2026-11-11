// Internal tests of the Arguments subsystem. A redesign may rewrite or delete
// them; the CLI evals (test/evals/cli.test.js) are what must keep passing.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse, UsageError, HelpRequested } from "../src/cli.js";

const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;
const css = new URL("./fixtures/theme.css", import.meta.url).pathname;

describe("parse", () => {
  it("gives preview its defaults", () => {
    expect(parse(["preview", flow])).toEqual({
      command: "preview", diagram: flow, stylesheet: null, scheme: "auto",
      port: 0, open: true, browserApp: null,
    });
  });

  it("gives export its defaults: NAME.svg and NAME.png next to the diagram", () => {
    expect(parse(["export", flow])).toEqual({
      command: "export", diagram: flow, stylesheet: null, scheme: "auto",
      svg: join(dirname(flow), "flow.svg"), png: join(dirname(flow), "flow.png"),
    });
  });

  it("takes the stylesheet from -c or --css, for either command", () => {
    for (const command of ["preview", "export"]) {
      expect(parse([command, "-c", css, flow]).stylesheet).toBe(css);
      expect(parse([command, flow, "--css", css]).stylesheet).toBe(css);
    }
  });

  it("reads -p, -n and -B for preview", () => {
    const options = parse(["preview", flow, "-p", "4000", "-n", "-B", "Google Chrome"]);
    expect(options.port).toBe(4000);
    expect(options.open).toBe(false);
    expect(options.browserApp).toBe("Google Chrome");
  });

  it("takes ports 0 to 65535 and nothing above", () => {
    expect(parse(["preview", flow, "-p", "65535"]).port).toBe(65535);
    expect(parse(["preview", flow, "-p", "0"]).port).toBe(0);
    expect(() => parse(["preview", flow, "-p", "70000"])).toThrowError(UsageError, /--port/);
  });

  it("picks the scheme auto, light or dark, and nothing else, for either command", () => {
    for (const command of ["preview", "export"]) {
      expect(parse([command, flow, "--scheme", "dark"]).scheme).toBe("dark");
      expect(parse([command, flow, "--scheme", "light"]).scheme).toBe("light");
      expect(() => parse([command, flow, "--scheme", "blue"])).toThrowError(UsageError, /--scheme must be one of auto, light, dark/);
    }
  });

  it("asks for help on -h or --help first, or anywhere after a command", () => {
    for (const args of [["-h"], ["--help"], ["preview", "-h"], ["export", flow, "--help"]]) {
      expect(() => parse(args)).withContext(args.join(" ")).toThrowError(HelpRequested);
    }
  });

  it("puts NAME.svg and NAME.png in the -o directory, resolved", () => {
    expect(parse(["export", "-o", "test", flow]).svg).toBe(join(process.cwd(), "test", "flow.svg"));
    expect(parse(["export", "-o", "test", flow]).png).toBe(join(process.cwd(), "test", "flow.png"));
    expect(parse(["export", "--output", tmpdir(), flow]).svg).toBe(join(tmpdir(), "flow.svg"));
  });

  describe("usage errors", () => {
    it("names a -o that isn't a directory", () => {
      expect(() => parse(["export", "-o", "nope", flow])).toThrowError(UsageError, "no such directory: nope");
      expect(() => parse(["export", "-o", css, flow])).toThrowError(UsageError, `no such directory: ${css}`);
    });

    it("won't put the PNG over the diagram or the stylesheet", () => {
      const dir = mkdtempSync(join(tmpdir(), "pele-laka-"));
      for (const name of ["d.png", "e.mmd", "e.png"]) writeFileSync(join(dir, name), "");
      expect(() => parse(["export", join(dir, "d.png")])).toThrowError(UsageError, `would overwrite ${join(dir, "d.png")}`);
      expect(() => parse(["export", "-c", join(dir, "e.png"), join(dir, "e.mmd")])).toThrowError(UsageError, `would overwrite ${join(dir, "e.png")}`);
      expect(() => parse(["export", "-c", join(dir, "e.png"), "-o", dir, flow])).not.toThrow();
    });

    it("won't put the SVG over the diagram or the stylesheet", () => {
      const dir = mkdtempSync(join(tmpdir(), "pele-laka-"));
      for (const name of ["d.svg", "e.mmd", "e.svg"]) writeFileSync(join(dir, name), "");
      expect(() => parse(["export", join(dir, "d.svg")])).toThrowError(UsageError, `would overwrite ${join(dir, "d.svg")}`);
      expect(() => parse(["export", "-c", join(dir, "e.svg"), join(dir, "e.mmd")])).toThrowError(UsageError, `would overwrite ${join(dir, "e.svg")}`);
      expect(() => parse(["export", "-c", join(dir, "e.svg"), "-o", dir, flow])).not.toThrow();
    });

    it("prints usage with no arguments, or a command and no diagram", () => {
      for (const args of [[], ["preview"], ["export", "-c", css]]) {
        expect(() => parse(args)).withContext(args.join(" ")).toThrowError(UsageError, /^usage: pele-laka/);
      }
    });

    it("names a first argument that isn't a command", () => {
      for (const word of ["render", flow, "Preview", "-n"]) {
        expect(() => parse([word, flow])).withContext(word).toThrowError(UsageError, new RegExp(`^unknown command: ${word}\n\nusage: `));
      }
    });

    it("rejects a second diagram", () => {
      expect(() => parse(["export", flow, css])).toThrowError(UsageError, /^unexpected argument: .*theme\.css\n\nusage: /);
    });

    it("rejects options of the other command", () => {
      for (const args of [["export", flow, "-p", "80"], ["export", flow, "-n"], ["export", flow, "-B", "x"], ["preview", flow, "-o", "."]]) {
        expect(() => parse(args)).withContext(args.join(" ")).toThrowError(UsageError, /\n\nusage: /);
      }
    });

    it("rejects a port that isn't a number", () => {
      expect(() => parse(["preview", flow, "-p", "abc"])).toThrowError(UsageError);
    });

    it("names files that don't exist", () => {
      expect(() => parse(["preview", "nope.mmd"])).toThrowError(/no such file: nope\.mmd/);
      expect(() => parse(["export", "-c", "nope.css", flow])).toThrowError(/no such file: nope\.css/);
    });
  });
});
