// @subsystem Arguments
import { parseArgs } from "node:util";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { SCHEMES } from "./compose.js";

export class UsageError extends Error {}
export class HelpRequested extends Error {}

export const USAGE = `usage: pele-laka preview [options] DIAGRAM.mmd
       pele-laka export [options] DIAGRAM.mmd

  -c, --css FILE       stylesheet to embed
      --scheme MODE    auto | light | dark (default: auto). light or dark
                       fixes the SVG, and the preview, to that scheme; auto
                       follows the viewer.
  -h, --help           show this message

preview:
  -p, --port N         port to serve on (default: ephemeral)
  -n, --no-open        don't open a browser, just print the URL
  -B, --browser APP    open in a specific app (macOS only), e.g. "Google Chrome"

export:
  -o, --output DIR     write into DIR instead of next to the diagram`;

const SHARED = {
  css: { type: "string", short: "c" },
  scheme: { type: "string" },
  help: { type: "boolean", short: "h" },
};

// Each command's options, and what it makes of them.
const COMMANDS = {
  preview: {
    options: {
      ...SHARED,
      port: { type: "string", short: "p" },
      "no-open": { type: "boolean", short: "n" },
      browser: { type: "string", short: "B" },
    },
    read: (values) => ({
      port: wholeNumber(values.port ?? "0", "--port", 65535),
      open: !values["no-open"],
      browserApp: values.browser ?? null,
    }),
  },
  export: {
    options: {
      ...SHARED,
      output: { type: "string", short: "o" },
    },
    read: (values, diagram, stylesheet) => {
      const dir = values.output === undefined ? dirname(diagram) : directory(values.output);
      const name = join(dir, basename(diagram, extname(diagram)));
      const files = { svg: `${name}.svg`, png: `${name}.png` };
      for (const path of Object.values(files)) {
        if (path === diagram || path === stylesheet) throw new UsageError(`would overwrite ${path}`);
      }
      return files;
    },
  },
};

// Throws instead of exiting so src/main.js owns every exit path.
export function parse(argv) {
  const [command, ...rest] = argv;
  if (command === "-h" || command === "--help") throw new HelpRequested(USAGE);
  if (command === undefined) throw new UsageError(USAGE);
  if (!Object.hasOwn(COMMANDS, command)) throw new UsageError(`unknown command: ${command}\n\n${USAGE}`);

  const { options, read } = COMMANDS[command];
  const { values, positionals } = parseStrict(rest, options);
  if (values.help) throw new HelpRequested(USAGE);
  if (positionals.length > 1) throw new UsageError(`unexpected argument: ${positionals[1]}\n\n${USAGE}`);
  if (!positionals.length) throw new UsageError(USAGE);

  const diagram = readable(positionals[0]);
  const stylesheet = values.css ? readable(values.css) : null;
  return {
    command,
    diagram,
    stylesheet,
    scheme: oneOf(values.scheme ?? "auto", "--scheme", SCHEMES),
    ...read(values, diagram, stylesheet),
  };
}

function parseStrict(args, options) {
  try {
    return parseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError(`${error.message}\n\n${USAGE}`);
  }
}

function readable(path) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new UsageError(`no such file: ${path}`);
  return resolve(path);
}

function directory(path) {
  if (!existsSync(path) || !statSync(path).isDirectory()) throw new UsageError(`no such directory: ${path}`);
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
