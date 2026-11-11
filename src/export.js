// @subsystem Export
// Writes an export's files and reports each one. Returns the exit code.
import { writeFileSync } from "node:fs";
import { readAndCompose, describeError } from "./compose.js";

const CONSOLE = { log: (line) => console.log(line), warn: (line) => console.error(line) };

export async function exportFiles(options, { log, warn } = CONSOLE) {
  try {
    writeFileSync(options.svg, readAndCompose(options));
    log(`wrote ${options.svg}`);
    return 0;
  } catch (error) {
    warn(describeError(error, options.diagram));
    return 1;
  }
}
