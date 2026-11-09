import { watch } from "node:fs";

// Watches the given files (not their directories) and calls onChange once
// per burst of changes. Many editors save by writing a new file and renaming
// it over the old one, which ends an fs.watch; on "rename" we re-attach to
// the new file at the same path.
export function watchFiles(paths, onChange, { delay = 100 } = {}) {
  if (!paths.every((path) => typeof path === "string")) throw new TypeError("watchFiles: every path must be a string");
  let timer = null;
  let closed = false;
  const watchers = new Map();

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => closed || onChange(), delay);
  };

  // A retry that succeeds means the file came back (e.g. deleted, then
  // recreated); report it, since the change that removed it already fired.
  const attach = (path, retry = false) => {
    if (closed) return;
    try {
      const watcher = watch(path, (event) => {
        changed();
        if (event === "rename") {
          watcher.close();
          setTimeout(() => attach(path), delay); // this event already reported the change
        }
      });
      watcher.on("error", () => {
        watcher.close();
        if (watchers.get(path) === watcher) watchers.delete(path);
        setTimeout(() => attach(path, true), delay);
      });
      watchers.set(path, watcher);
      if (retry) changed();
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
