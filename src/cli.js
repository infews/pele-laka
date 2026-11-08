// @subsystem Arguments
import { parseArgs } from "node:util";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { SCHEMES } from "./compose.js";

export class UsageError extends Error {}
export class HelpRequested extends Error {}

export const USAGE = `usage: pele-preview DIAGRAM.mmd [STYLE.css] [options]

  -o, --output FILE    write a self-contained SVG to FILE and exit (no server)
  -c, --css FILE       stylesheet (same as the second positional argument)
  -p, --port N         port to serve on (default: ephemeral)
  -n, --no-open        don't open a browser, just print the URL
  -B, --browser APP    open in a specific app (macOS only), e.g. "Google Chrome"
      --scheme MODE    auto | light | dark (default: auto). light or dark
                       fixes the SVG, and the preview, to that scheme; auto
                       follows the viewer.
  -h, --help           show this message`;

const OPTIONS = {
  output: { type: "string", short: "o" },
  css: { type: "string", short: "c" },
  port: { type: "string", short: "p" },
  "no-open": { type: "boolean", short: "n" },
  browser: { type: "string", short: "B" },
  scheme: { type: "string" },
  help: { type: "boolean", short: "h" },
};

// Throws instead of exiting so src/main.js owns every exit path.
export function parse(argv) {
  const { values, positionals } = parseStrict(argv);
  if (values.help) throw new HelpRequested(USAGE);

  const diagram = positionals.shift();
  const stylesheet = values.css ?? positionals.shift();
  if (positionals.length) throw new UsageError(`unexpected argument: ${positionals[0]}\n\n${USAGE}`);
  if (!diagram) throw new UsageError(USAGE);

  return {
    diagram: readable(diagram),
    stylesheet: stylesheet ? readable(stylesheet) : null,
    output: values.output ? resolve(values.output) : null,
    port: wholeNumber(values.port ?? "0", "--port", 65535),
    open: !values["no-open"],
    browserApp: values.browser ?? null,
    scheme: oneOf(values.scheme ?? "auto", "--scheme", SCHEMES),
  };
}

function parseStrict(argv) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError(`${error.message}\n\n${USAGE}`);
  }
}

function readable(path) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new UsageError(`no such file: ${path}`);
  return resolve(path);
}

function oneOf(text, flag, choices) {
  if (!choices.includes(text)) throw new UsageError(`${flag} must be one of ${choices.join(", ")}, got: ${text}`);
  return text;
}

// A whole number from 0 to max.
function wholeNumber(text, flag, max) {
  if (!/^\d+$/.test(text)) throw new UsageError(`${flag} must be a whole number, got: ${text}`);
  const n = Number(text);
  if (n > max) throw new UsageError(`${flag} must be between 0 and ${max}, got: ${text}`);
  return n;
}
