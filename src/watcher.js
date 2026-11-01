import { watch } from "node:fs";

// Watches the given files (not their directories) and calls onChange once
// per burst of changes. Many editors save by writing a new file and renaming
// it over the old one, which ends an fs.watch; on "rename" we re-attach to
// the new file at the same path.
export function watchFiles(paths, onChange, { delay = 100 } = {}) {
  let timer = null;
  let closed = false;
  const watchers = new Map();

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => closed || onChange(), delay);
  };

  const attach = (path) => {
    if (closed) return;
    try {
      const watcher = watch(path, (event) => {
        changed();
        if (event === "rename") {
          watcher.close();
          setTimeout(() => attach(path), delay);
        }
      });
      watchers.set(path, watcher);
    } catch {
      setTimeout(() => attach(path), delay); // file briefly absent mid-save
    }
  };

  paths.forEach(attach);

  return {
    close() {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers.values()) watcher.close();
    },
  };
}
