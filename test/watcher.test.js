// Internal tests of part of the Preview subsystem. A redesign may rewrite or
// delete them; the PREVIEW evals (test/evals/preview.test.js) must keep passing.
import { EventEmitter } from "node:events";
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

// Runs `body(watcher)` against watchFiles(paths, onChange, options), always
// closing the watcher.
async function watching(paths, onChange, options, body) {
  const watcher = watchFiles(paths, onChange, options);
  try {
    await body(watcher);
  } finally {
    watcher.close();
  }
}

// A stand-in for fs.watch: records each watcher it makes, so a spec can fire
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

describe("watchFiles", () => {
  it("watches only paths", () => {
    expect(() => watchFiles([null], () => {})).toThrowError(TypeError, "watchFiles: every path must be a string");
    expect(() => watchFiles(["a", undefined], () => {})).toThrowError(TypeError);
  });

  describe("on real files", () => {
    it("calls back once for a burst of writes", async () => {
      const path = tempFile();
      let calls = 0;
      await watching([path], () => calls++, { delay: 50 }, async () => {
        await sleep(50);
        writeFileSync(path, "b");
        writeFileSync(path, "c");
        writeFileSync(path, "d");
        await sleep(300);
        expect(calls).toBe(1);
      });
    });

    it("calls back once for a burst across both watched files", async () => {
      const diagram = tempFile();
      const stylesheet = tempFile();
      let calls = 0;
      await watching([diagram, stylesheet], () => calls++, { delay: 50 }, async () => {
        await sleep(50);
        writeFileSync(diagram, "b");
        writeFileSync(stylesheet, "b");
        await sleep(300);
        expect(calls).toBe(1);
      });
    });

    it("keeps watching after an editor replaces the file by rename", async () => {
      const path = tempFile();
      let calls = 0;
      await watching([path], () => calls++, { delay: 50 }, async () => {
        await sleep(50);
        writeFileSync(`${path}.tmp`, "replaced");
        renameSync(`${path}.tmp`, path);
        await sleep(300);
        expect(calls).withContext("rename seen").toBeGreaterThanOrEqual(1);

        const before = calls;
        writeFileSync(path, "edited again");
        await sleep(300);
        expect(calls).withContext("write after rename seen").toBe(before + 1);
      });
    });

    it("calls back once for a rename-save", async () => {
      const path = tempFile();
      let calls = 0;
      await watching([path], () => calls++, { delay: 50 }, async () => {
        await sleep(50);
        writeFileSync(`${path}.tmp`, "replaced");
        renameSync(`${path}.tmp`, path);
        await sleep(400);
        expect(calls).toBe(1);
      });
    });

    it("calls back when a deleted file is created again", async () => {
      const path = tempFile();
      const seen = [];
      await watching([path], () => seen.push(existsSync(path)), { delay: 50 }, async () => {
        await sleep(50);
        unlinkSync(path);
        await sleep(300);
        writeFileSync(path, "back");
        await sleep(300);
        expect(seen).withContext("a callback saw the recreated file").toContain(true);
      });
    });

    it("stops calling back on close, even with a change pending", async () => {
      const path = tempFile();
      let calls = 0;
      const watcher = watchFiles([path], () => calls++, { delay: 200 });
      await sleep(50);
      writeFileSync(path, "b");
      await sleep(50); // let the event arrive and start the debounce timer
      watcher.close(); // ...then close before the timer expires
      await sleep(400);
      expect(calls).toBe(0);
    });
  });

  describe("with a stand-in for fs.watch", () => {
    it("closes a watcher that errors, watches the file again, and reports a change", async () => {
      const { watch, made } = fakeWatch();
      let calls = 0;
      await watching(["d.mmd"], () => calls++, { delay: 10, watch }, async () => {
        made[0].emit("error", new Error("EPERM"));
        expect(made[0].closed).withContext("the failed watcher is closed").toBe(true);
        await sleep(60);
        expect(made.length).withContext("the file is watched again").toBe(2);
        expect(made[1].path).toBe("d.mmd");
        expect(calls).withContext("the re-attach reports a change").toBe(1);

        made[1].listener("change");
        await sleep(60);
        expect(calls).withContext("the next save still fires").toBe(2);
      });
    });

    it("keeps the same watcher for a plain change", async () => {
      const { watch, made } = fakeWatch();
      let calls = 0;
      await watching(["d.mmd"], () => calls++, { delay: 10, watch }, async () => {
        made[0].listener("change");
        await sleep(60);
        expect(calls).toBe(1);
        expect(made.length).withContext("no re-attach").toBe(1);
        expect(made[0].closed).toBe(false);
      });
    });

    it("watches nothing after close, with a re-attach pending", async () => {
      const { watch, made } = fakeWatch();
      let calls = 0;
      const watcher = watchFiles(["d.mmd"], () => calls++, { delay: 30, watch });
      made[0].listener("rename");
      watcher.close();
      await sleep(120);
      expect(made.length).withContext("no re-attach after close").toBe(1);
      expect(calls).toBe(0);
    });

    it("closes every watcher on close", () => {
      const { watch, made } = fakeWatch();
      watchFiles(["d.mmd", "s.css"], () => {}, { watch }).close();
      expect(made.map((w) => w.closed)).toEqual([true, true]);
    });
  });
});
