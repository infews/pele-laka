import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, renameSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { watchFiles } from "../src/watcher.js";

const tempFile = () => {
  const path = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "d.mmd");
  writeFileSync(path, "a");
  return path;
};

test("a burst of writes produces one callback", async () => {
  const path = tempFile();
  let calls = 0;
  const watcher = watchFiles([path], () => calls++, { delay: 50 });
  try {
    await sleep(50);
    writeFileSync(path, "b");
    writeFileSync(path, "c");
    writeFileSync(path, "d");
    await sleep(300);
    assert.equal(calls, 1);
  } finally {
    watcher.close();
  }
});

test("keeps watching after an editor replaces the file by rename", async () => {
  const path = tempFile();
  let calls = 0;
  const watcher = watchFiles([path], () => calls++, { delay: 50 });
  try {
    await sleep(50);
    writeFileSync(`${path}.tmp`, "replaced");
    renameSync(`${path}.tmp`, path);
    await sleep(300);
    assert.ok(calls >= 1, "rename seen");

    const before = calls;
    writeFileSync(path, "edited again");
    await sleep(300);
    assert.equal(calls, before + 1, "write after rename seen");
  } finally {
    watcher.close();
  }
});

test("close stops callbacks", async () => {
  const path = tempFile();
  let calls = 0;
  watchFiles([path], () => calls++, { delay: 20 }).close();
  writeFileSync(path, "b");
  await sleep(150);
  assert.equal(calls, 0);
});

test("a deleted file that is later recreated triggers a callback", async () => {
  const path = tempFile();
  const seen = [];
  const watcher = watchFiles([path], () => seen.push(existsSync(path)), { delay: 50 });
  try {
    await sleep(50);
    unlinkSync(path);
    await sleep(300);
    writeFileSync(path, "back");
    await sleep(300);
    assert.ok(seen.includes(true), `a callback saw the recreated file (saw ${JSON.stringify(seen)})`);
  } finally {
    watcher.close();
  }
});
