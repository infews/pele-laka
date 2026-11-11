// Internal tests of the Export subsystem (src/export.js). A redesign may rewrite
// or delete them; the EXPORT evals are what must keep passing.
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportFiles } from "../src/export.js";
import { readAndCompose } from "../src/compose.js";

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

// An export of `diagram` into a fresh directory, on a machine without Chrome.
function exporting(diagram) {
  const dir = mkdtempSync(join(tmpdir(), "pele-laka-export-"));
  const options = { diagram, stylesheet: fixture("theme.css"), scheme: "auto", svg: join(dir, "out.svg"), png: join(dir, "out.png") };
  const lines = { log: [], warn: [] };
  const using = { log: (line) => lines.log.push(line), warn: (line) => lines.warn.push(line), findChrome: () => null };
  return { dir, options, lines, run: () => exportFiles(options, using) };
}

describe("exportFiles", () => {
  it("writes the composed SVG, says so, skips the PNG without Chrome, and returns 0", async () => {
    const { dir, options, lines, run } = exporting(fixture("flow.mmd"));
    expect(await run()).toBe(0);
    expect(readFileSync(options.svg, "utf8")).toBe(readAndCompose(options));
    expect(readdirSync(dir)).toEqual(["out.svg"]);
    expect(lines).toEqual({ log: [`wrote ${options.svg}`], warn: [`skipped ${options.png}: PNG export needs Google Chrome`] });
  });

  describe("with a Chrome", () => {
    // Runs the export with Chrome at /a/chrome and `drawPng` in its place.
    async function withChrome(scheme, drawPng) {
      const { dir, options, lines } = exporting(fixture("flow.mmd"));
      options.scheme = scheme;
      const using = { log: (line) => lines.log.push(line), warn: (line) => lines.warn.push(line), findChrome: () => "/a/chrome", drawPng };
      return { dir, options, lines, code: () => exportFiles(options, using) };
    }

    it("writes the PNG Chrome draws after the SVG, says so, and returns 0", async () => {
      const { options, lines, code } = await withChrome("auto", async () => Buffer.from("png bytes"));
      expect(await code()).toBe(0);
      expect(readFileSync(options.png, "utf8")).toBe("png bytes");
      expect(lines).toEqual({ log: [`wrote ${options.svg}`, `wrote ${options.png}`], warn: [] });
    });

    it("hands Chrome the SVG fixed dark for dark, and light for light or auto", async () => {
      for (const scheme of ["auto", "light", "dark"]) {
        const drawn = [];
        const { options, code } = await withChrome(scheme, async (svg, chrome) => { drawn.push([svg, chrome]); return Buffer.from(""); });
        await code();
        const fixed = scheme === "dark" ? "dark" : "light";
        expect(drawn).withContext(scheme).toEqual([[readAndCompose({ ...options, scheme: fixed }), "/a/chrome"]]);
      }
    });

    it("names the PNG and Chrome's error, keeps the SVG and an old PNG, and returns 1", async () => {
      const { options, lines, code } = await withChrome("auto", async () => { throw new Error("chrome broke"); });
      writeFileSync(options.png, "previous");
      expect(await code()).toBe(1);
      expect(readFileSync(options.png, "utf8")).toBe("previous");
      expect(readFileSync(options.svg, "utf8")).toBe(readAndCompose(options));
      expect(lines).toEqual({ log: [`wrote ${options.svg}`], warn: [`${options.png}: chrome broke`] });
    });
  });

  it("describes a render error, writes nothing, and returns 1", async () => {
    const { dir, lines, run } = exporting(fixture("broken.mmd"));
    expect(await run()).toBe(1);
    expect(readdirSync(dir)).toEqual([]);
    expect(lines.log).toEqual([]);
    expect(lines.warn).toEqual([jasmine.stringMatching(new RegExp(`^${fixture("broken.mmd")}:2:9: `))]);
  });
});
