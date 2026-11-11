// @subsystem Export
// Writes an export's files and reports each one. Returns the exit code.
import { writeFileSync } from "node:fs";
import { readAndCompose, describeError } from "./compose.js";
import { findChrome as findInstalledChrome } from "./png.js";

const USING = {
  log: (line) => console.log(line),
  warn: (line) => console.error(line),
  findChrome: () => findInstalledChrome(),
};

export async function exportFiles(options, { log, warn, findChrome } = USING) {
  try {
    writeFileSync(options.svg, readAndCompose(options));
    log(`wrote ${options.svg}`);
  } catch (error) {
    warn(describeError(error, options.diagram));
    return 1;
  }
  if (!findChrome()) warn(`skipped ${options.png}: PNG export needs Google Chrome`);
  return 0;
}
