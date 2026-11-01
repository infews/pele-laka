import { spawn } from "node:child_process";

export function openCommand(url, { app = null, platform = process.platform } = {}) {
  if (app) return ["open", "-a", app, url];
  return platform === "darwin" ? ["open", url] : ["xdg-open", url];
}

// Best effort: a machine with no opener is not an error, because the URL has
// already been printed.
export function launch(url, options) {
  const [command, ...args] = openCommand(url, options);
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}
