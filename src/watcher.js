import { watch as fsWatch } from "node:fs";

// Watches the given files (not their directories) and calls onChange once
// per burst of changes. Many editors save by writing a new file and renaming
// it over the old one, which ends an fs.watch; on "rename" we re-attach to
// the new file at the same path. `watch` stands in for fs.watch in tests.
export function watchFiles(paths, onChange, { delay = 100, watch = fsWatch } = {}) {
  if (!paths.every((path) => typeof path === "string")) throw new TypeError("watchFiles: every path must be a string");
  let timer = null;
  let closed = false;
  const watchers = new Map();

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, delay);
  };

  // Drops a watcher that has ended and watches the path again shortly. With
  // `report`, the re-attach reports a change: the file may differ by then.
  const reattach = (watcher, path, report) => {
    watcher.close();
    setTimeout(() => attach(path, report), delay);
  };

  const attach = (path, report = false) => {
    if (closed) return;
    try {
      const watcher = watch(path, (event) => {
        changed();
        if (event === "rename") reattach(watcher, path, false); // this event already reported the change
      });
      watcher.on("error", () => reattach(watcher, path, true));
      watchers.set(path, watcher);
      if (report) changed();
    } catch {
      setTimeout(() => attach(path, true), delay); // file absent (mid-save or deleted)
    }
  };

  paths.forEach((path) => attach(path));

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers.values()) watcher.close();
    },
  };
}
