// Internal tests of src/main.js's output on stderr, beyond what the evals pin.
// A redesign may rewrite or delete them.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = new URL("../bin/pele-laka", import.meta.url).pathname;
const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;

describe("pele-laka's stderr", () => {
  it("stays empty for a preview that starts cleanly", async () => {
    const child = spawn(process.execPath, [bin, "preview", flow, "-n"]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const exited = new Promise((resolve) => child.once("exit", resolve));
    while (!stdout.includes("http://")) await new Promise((resolve) => setTimeout(resolve, 25));
    child.kill("SIGINT");
    await exited;
    expect(stderr).toBe("");
  });

  it("holds one line, and nothing more, when the server can't start", async () => {
    const busy = createServer();
    await new Promise((resolve) => busy.listen(0, "127.0.0.1", resolve));
    try {
      const result = spawnSync(process.execPath, [bin, "preview", flow, "-n", "-p", String(busy.address().port)], { encoding: "utf8", timeout: 5000 });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/^could not start server: [^\n]*\n$/);
    } finally {
      busy.close();
    }
  });
});

describe("pele-laka export's stdout", () => {
  it("begins with wrote <svg>", () => {
    const out = mkdtempSync(join(tmpdir(), "pele-laka-main-"));
    const env = { ...process.env, CHROME_PATH: join(out, "no-chrome") };
    const result = spawnSync(process.execPath, [bin, "export", "-o", out, flow], { encoding: "utf8", env });
    expect(result.stdout.split("\n")[0]).toBe(`wrote ${join(out, "flow.svg")}`);
  });
});
