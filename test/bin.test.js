// Export behavior is pinned by test/evals/export.test.js; these cover the
// command line and preview until those areas are adopted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = new URL("../bin/pele-preview", import.meta.url).pathname;
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

test("--palette marks the exported svg", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "out.svg");
  const result = run(fixture("flow.mmd"), fixture("palettes.css"), "--palette", "paper", "-o", out);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(out, "utf8"), /^<svg data-pele-scheme="paper" /);
  assert.equal(result.stderr, "");
});

test("a --palette the stylesheet doesn't define still exports, with a warning", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "out.svg");
  const result = run(fixture("flow.mmd"), fixture("palettes.css"), "--palette", "harbor", "-o", out);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /palette "harbor" is not defined in .*palettes\.css \(it defines: carbon, paper, moss\)/);
});

test("usage errors exit 2", () => {
  const result = run("missing.mmd");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no such file: missing\.mmd/);
});

test("--help prints usage and exits 0", () => {
  const result = run("--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^usage: pele-preview/);
});

test("preview mode serves the composed svg and exits 0 on SIGINT", { timeout: 5000 }, async () => {
  const child = spawn(process.execPath, [bin, fixture("flow.mmd"), fixture("theme.css"), "-n"]);
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  try {
    const url = await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) resolve(match[0]);
      });
      exited.then(({ code }) => reject(new Error(`exited ${code}`)));
    });
    const svg = await (await fetch(`${url}diagram.svg`)).text();
    assert.match(svg, /--pele-surface: #eae7e7/);

    child.kill("SIGINT");
    assert.deepEqual(await exited, { code: 0, signal: null });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
});
