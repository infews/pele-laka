// Internal: --palette, which no eval pins because epic 0002 removes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
