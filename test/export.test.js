// Internal tests of the Export subsystem (src/export.js). A redesign may rewrite
// or delete them; the EXPORT evals are what must keep passing.
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportFiles } from "../src/export.js";
import { readAndCompose } from "../src/compose.js";

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

function exporting(diagram) {
  const dir = mkdtempSync(join(tmpdir(), "pele-laka-export-"));
  const options = { diagram, stylesheet: fixture("theme.css"), scheme: "auto", svg: join(dir, "out.svg") };
  const lines = { log: [], warn: [] };
  const report = { log: (line) => lines.log.push(line), warn: (line) => lines.warn.push(line) };
  return { dir, options, lines, run: () => exportFiles(options, report) };
}

describe("exportFiles", () => {
  it("writes the composed SVG, says so, and returns 0", async () => {
    const { options, lines, run } = exporting(fixture("flow.mmd"));
    expect(await run()).toBe(0);
    expect(readFileSync(options.svg, "utf8")).toBe(readAndCompose(options));
    expect(lines).toEqual({ log: [`wrote ${options.svg}`], warn: [] });
  });

  it("describes a render error, writes nothing, and returns 1", async () => {
    const { dir, lines, run } = exporting(fixture("broken.mmd"));
    expect(await run()).toBe(1);
    expect(readdirSync(dir)).toEqual([]);
    expect(lines.log).toEqual([]);
    expect(lines.warn).toEqual([jasmine.stringMatching(new RegExp(`^${fixture("broken.mmd")}:2:9: `))]);
  });
});
