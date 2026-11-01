import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = new URL("../bin/pele-preview", import.meta.url).pathname;
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

test("-o writes an svg with the stylesheet embedded", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "out.svg");
  const result = run(fixture("flow.mmd"), fixture("theme.css"), "-o", out);
  assert.equal(result.status, 0, result.stderr);
  const svg = readFileSync(out, "utf8");
  assert.match(svg, /^<svg [^>]*><style><!\[CDATA\[/);
  assert.match(svg, /--pele-surface: #eae7e7/);
});

test("a broken diagram exits 1 with its location", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "out.svg");
  const result = run(fixture("broken.mmd"), "-o", out);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken\.mmd:2:9: Parse error/);
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

test("preview mode serves the composed svg", async () => {
  const child = spawn(process.execPath, [bin, fixture("flow.mmd"), fixture("theme.css"), "-n"]);
  try {
    const url = await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) resolve(match[0]);
      });
      child.on("exit", (code) => reject(new Error(`exited ${code}`)));
    });
    const svg = await (await fetch(`${url}diagram.svg`)).text();
    assert.match(svg, /--pele-surface: #eae7e7/);
  } finally {
    child.kill("SIGINT");
  }
});
