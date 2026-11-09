// Internal tests of part of the Preview subsystem. A redesign may rewrite or
// delete them; the PREVIEW evals (test/evals/preview.test.js) must keep passing.
import { test } from "node:test";
import { EventEmitter } from "node:events";
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

test("only paths can be watched", () => {
  assert.throws(() => watchFiles([null], () => {}), { name: "TypeError", message: "watchFiles: every path must be a string" });
  assert.throws(() => watchFiles(["a", undefined], () => {}), TypeError);
});

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

test("close stops callbacks, even with a change pending", async () => {
  const path = tempFile();
  let calls = 0;
  const watcher = watchFiles([path], () => calls++, { delay: 200 });
  await sleep(50);
  writeFileSync(path, "b");
  await sleep(50); // let the event arrive and start the debounce timer
  watcher.close(); // ...then close before the timer expires
  await sleep(400);
  assert.equal(calls, 0);
});

test("a burst across both watched files produces one callback", async () => {
  const diagram = tempFile();
  const stylesheet = tempFile();
  let calls = 0;
  const watcher = watchFiles([diagram, stylesheet], () => calls++, { delay: 50 });
  try {
    await sleep(50);
    writeFileSync(diagram, "b");
    writeFileSync(stylesheet, "b");
    await sleep(300);
    assert.equal(calls, 1);
  } finally {
    watcher.close();
  }
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

test("a rename-save produces one callback", async () => {
  const path = tempFile();
  let calls = 0;
  const watcher = watchFiles([path], () => calls++, { delay: 50 });
  try {
    await sleep(50);
    writeFileSync(`${path}.tmp`, "replaced");
    renameSync(`${path}.tmp`, path);
    await sleep(400);
    assert.equal(calls, 1);
  } finally {
    watcher.close();
  }
});

// A stand-in for fs.watch: records each watcher it makes, so a test can fire
// events and errors on it and see whether it was closed.
function fakeWatch() {
  const made = [];
  const watch = (path, listener) => {
    const watcher = Object.assign(new EventEmitter(), { path, listener, closed: false });
    watcher.close = () => { watcher.closed = true; };
    made.push(watcher);
    return watcher;
  };
  return { watch, made };
}

test("a watch error closes that watcher, watches the file again, and reports a change", async () => {
  const { watch, made } = fakeWatch();
  let calls = 0;
  const watcher = watchFiles(["d.mmd"], () => calls++, { delay: 10, watch });
  try {
    made[0].emit("error", new Error("EPERM"));
    assert.equal(made[0].closed, true, "the failed watcher is closed");
    await sleep(60);
    assert.equal(made.length, 2, "the file is watched again");
    assert.equal(made[1].path, "d.mmd");
    assert.equal(calls, 1, "the re-attach reports a change");

    made[1].listener("change");
    await sleep(60);
    assert.equal(calls, 2, "the next save still fires");
  } finally {
    watcher.close();
  }
});

test("close with a re-attach pending watches nothing afterwards", async () => {
  const { watch, made } = fakeWatch();
  let calls = 0;
  const watcher = watchFiles(["d.mmd"], () => calls++, { delay: 30, watch });
  made[0].listener("rename");
  watcher.close();
  await sleep(120);
  assert.equal(made.length, 1, "no re-attach after close");
  assert.equal(calls, 0);
});

test("close closes every watcher", () => {
  const { watch, made } = fakeWatch();
  watchFiles(["d.mmd", "s.css"], () => {}, { watch }).close();
  assert.deepEqual(made.map((w) => w.closed), [true, true]);
});

test("a plain change keeps the same watcher", async () => {
  const { watch, made } = fakeWatch();
  let calls = 0;
  const watcher = watchFiles(["d.mmd"], () => calls++, { delay: 10, watch });
  try {
    made[0].listener("change");
    await sleep(60);
    assert.equal(calls, 1);
    assert.equal(made.length, 1, "no re-attach");
    assert.equal(made[0].closed, false);
  } finally {
    watcher.close();
  }
});
