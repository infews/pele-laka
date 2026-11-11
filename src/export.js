// @subsystem Export
// Writes an export's files and reports each one. Returns the exit code.
import { writeFileSync } from "node:fs";
import { readAndCompose, describeError } from "./compose.js";
import * as png from "./png.js";

const USING = {
  log: (line) => console.log(line),
  warn: (line) => console.error(line),
  findChrome: () => png.findChrome(),
  drawPng: (svg, chrome) => png.drawPng(svg, chrome),
};

// The SVG, then the PNG of it. The PNG is drawn dark for --scheme dark and
// light otherwise, and written only once Chrome has drawn all of it.
export async function exportFiles(options, { log, warn, findChrome, drawPng } = USING) {
  try {
    writeFileSync(options.svg, readAndCompose(options));
    log(`wrote ${options.svg}`);
  } catch (error) {
    warn(describeError(error, options.diagram));
    return 1;
  }

  const chrome = findChrome();
  if (!chrome) {
    warn(`skipped ${options.png}: PNG export needs Google Chrome`);
    return 0;
  }
  try {
    const scheme = options.scheme === "dark" ? "dark" : "light";
    writeFileSync(options.png, await drawPng(readAndCompose({ ...options, scheme }), chrome));
    log(`wrote ${options.png}`);
    return 0;
  } catch (error) {
    warn(`${options.png}: ${error.message}`);
    return 1;
  }
}
