// Internal tests of the Arguments subsystem. A redesign may rewrite or delete
// them; the CLI evals (test/evals/cli.test.js) are what must keep passing.
import { resolve } from "node:path";
import { parse, UsageError, HelpRequested } from "../src/cli.js";

const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;
const css = new URL("./fixtures/theme.css", import.meta.url).pathname;

describe("parse", () => {
  it("gives preview defaults for a diagram alone", () => {
    expect(parse([flow])).toEqual({
      diagram: flow, stylesheet: null, output: null, port: 0,
      open: true, browserApp: null, scheme: "auto",
    });
  });

  it("takes the stylesheet as the second positional, -c or --css", () => {
    expect(parse([flow, css]).stylesheet).toBe(css);
    expect(parse([flow, "-c", css]).stylesheet).toBe(css);
    expect(parse([flow, "--css", css]).stylesheet).toBe(css);
  });

  it("resolves the -o path, which need not exist", () => {
    expect(parse([flow, "-o", "out.svg"]).output).toBe(resolve("out.svg"));
  });

  it("reads -p, -n and -B", () => {
    const options = parse([flow, "-p", "4000", "-n", "-B", "Google Chrome"]);
    expect(options.port).toBe(4000);
    expect(options.open).toBe(false);
    expect(options.browserApp).toBe("Google Chrome");
  });

  it("takes ports 0 to 65535 and nothing above", () => {
    expect(parse([flow, "-p", "65535"]).port).toBe(65535);
    expect(parse([flow, "-p", "0"]).port).toBe(0);
    expect(() => parse([flow, "-p", "70000"])).toThrowError(UsageError, /--port/);
  });

  it("picks the scheme auto, light or dark, and nothing else", () => {
    expect(parse([flow, "--scheme", "dark"]).scheme).toBe("dark");
    expect(parse([flow, "--scheme", "light"]).scheme).toBe("light");
    expect(() => parse([flow, "--scheme", "blue"])).toThrowError(UsageError, /--scheme must be one of auto, light, dark/);
  });

  it("asks for help on -h, even without a diagram", () => {
    expect(() => parse(["-h"])).toThrowError(HelpRequested);
  });

  describe("usage errors", () => {
    it("rejects -c plus a second positional", () => {
      expect(() => parse([flow, css, "-c", css])).toThrowError(UsageError, /unexpected argument/);
    });

    it("rejects a port that isn't a number", () => {
      expect(() => parse([flow, "-p", "abc"])).toThrowError(UsageError);
    });

    it("prints usage when the diagram is missing", () => {
      expect(() => parse([])).toThrowError(UsageError, /^usage: pele-preview/);
    });

    it("names files that don't exist", () => {
      expect(() => parse(["nope.mmd"])).toThrowError(/no such file: nope\.mmd/);
      expect(() => parse([flow, "nope.css"])).toThrowError(/no such file: nope\.css/);
    });

    it("rejects unknown flags", () => {
      expect(() => parse([flow, "--theme", "dark"])).toThrowError(UsageError);
    });
  });
});
