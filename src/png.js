// @subsystem PNG
// Finds Google Chrome, which draws export's PNG.
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";

export const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// The path of the Chrome to run, or null when there is none: CHROME_PATH when
// set, otherwise Chrome's standard install location for the platform.
export function findChrome({ env = process.env, platform = process.platform } = {}) {
  if (env.CHROME_PATH) return executable(env.CHROME_PATH);
  if (platform === "darwin") return executable(MAC_CHROME);
  if (platform === "linux") return onPath("google-chrome", env.PATH);
  return null;
}

function onPath(name, path = "") {
  for (const dir of path.split(delimiter).filter(Boolean)) {
    const found = executable(join(dir, name));
    if (found) return found;
  }
  return null;
}

function executable(path) {
  try {
    if (!statSync(path).isFile()) return null;
    accessSync(path, constants.X_OK);
    return path;
  } catch {
    return null;
  }
}
