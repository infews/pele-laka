// Internal tests of src/main.js's output on stderr, beyond what the evals pin.
// A redesign may rewrite or delete them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const bin = new URL("../bin/pele-preview", import.meta.url).pathname;
const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;

test("a preview that starts cleanly writes nothing to stderr", { timeout: 10000 }, async () => {
  const child = spawn(process.execPath, [bin, flow, "-n"]);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  while (!stdout.includes("http://")) await new Promise((resolve) => setTimeout(resolve, 25));
  child.kill("SIGINT");
  await exited;
  assert.equal(stderr, "");
});

test("a server that can't start prints one line and nothing more", async () => {
  const busy = createServer();
  await new Promise((resolve) => busy.listen(0, "127.0.0.1", resolve));
  try {
    const result = spawnSync(process.execPath, [bin, flow, "-n", "-p", String(busy.address().port)], { encoding: "utf8", timeout: 5000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^could not start server: [^\n]*\n$/);
  } finally {
    busy.close();
  }
});
