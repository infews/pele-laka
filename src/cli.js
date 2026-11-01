import { parseArgs } from "node:util";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export class UsageError extends Error {}
export class HelpRequested extends Error {}

export const USAGE = `usage: pele-preview DIAGRAM.mmd [STYLE.css] [options]

  -o, --output FILE    write a self-contained SVG to FILE and exit (no server)
  -c, --css FILE       stylesheet (same as the second positional argument)
  -p, --port N         port to serve on (default: ephemeral)
  -n, --no-open        don't open a browser, just print the URL
  -B, --browser APP    open in a specific app, e.g. "Google Chrome"
      --font FAMILY    font family pele measures labels with (default: sans-serif)
      --font-size N    font size pele measures labels with (default: 16)
  -h, --help           show this message`;

const OPTIONS = {
  output: { type: "string", short: "o" },
  css: { type: "string", short: "c" },
  port: { type: "string", short: "p" },
  "no-open": { type: "boolean", short: "n" },
  browser: { type: "string", short: "B" },
  font: { type: "string" },
  "font-size": { type: "string" },
  help: { type: "boolean", short: "h" },
};

// Throws instead of exiting so bin/pele-preview owns every exit path.
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
    port: wholeNumber(values.port ?? "0", "--port"),
    open: !values["no-open"],
    browserApp: values.browser ?? null,
    fontFamily: values.font ?? null,
    fontSize: values["font-size"] ? wholeNumber(values["font-size"], "--font-size") : null,
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

function wholeNumber(text, flag) {
  if (!/^\d+$/.test(text)) throw new UsageError(`${flag} must be a whole number, got: ${text}`);
  return Number(text);
}
