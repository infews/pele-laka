# pele-preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Ruby + mermaid-cli `mmd-preview` with `pele-preview`, a Node CLI that renders a `.mmd` file with pele, embeds a user CSS file in the SVG, and either serves a live preview or writes the SVG to disk.

**Architecture:** One pure function, `compose(mmd, css, fontOpts)`, calls `pele.render` and inserts the CSS as a CDATA `<style>` at the top of the SVG. Export mode writes its result; preview mode serves it from a loopback `node:http` server and pushes reloads over Server-Sent Events when `fs.watch` sees either input change.

**Tech Stack:** Node ≥ 20, plain JavaScript (ESM), `pele@^1.13.0` (only dependency), `node:test` + `node:assert`, `xmllint` (macOS built-in) for XML checks in tests.

**Spec:** `docs/superpowers/specs/2026-11-01-pele-rewrite-design.md`

---

## Facts about pele the code relies on (verified against 1.13.0)

- `render(text, { fontFamily, fontSize })` returns `{ svg, width, height, ... }`. `svg` begins with `<svg xmlns=…>` and contains **no** `<style>` element.
- `fontFamily` shows up in the output as `font-family:var(--pele-font,<family>)`; `fontSize` changes measured widths.
- Errors throw `PeleError` (exported from `pele`) with `message`, `code`, `line`, `column`, `snippet`. A syntax error has `line ≥ 1`; "no diagram type detected" has `code: "unsupported-diagram"`, `line: 0`.

## File map

| Path | Responsibility |
|---|---|
| `package.json` | name `pele-preview`, `bin`, `pele` dependency, `npm test` |
| `bin/pele-preview` | entry point; owns exit codes and printing |
| `src/compose.js` | `compose`, `readAndCompose`, `describeError` |
| `src/cli.js` | argv → options; `UsageError`, `HelpRequested`, `USAGE` |
| `src/watcher.js` | `watchFiles(paths, onChange)` — debounced, survives rename-on-save |
| `src/server.js` | `startServer({ port, render, describe })` |
| `src/page.html` | preview page |
| `src/browser.js` | `openCommand`, `launch` |
| `test/*.test.js` | one file per module, plus `bin.test.js` |
| `test/fixtures/` | `flow.mmd`, `broken.mmd`, `theme.css` |

---

### Task 0: Clear the working tree

The working tree has uncommitted Ruby edits (`Gemfile`, `Gemfile.lock`, `README.md`, `lib/mermaid_preview/watcher.rb`, `test/watcher_spec.rb`), three staged-then-deleted `.mmd` files, and an untracked `theseus.svg`.

- [ ] **Step 1: Ask the user** whether to commit those changes first (preserves them in history), stash them, or discard them. Do not proceed until answered. Leave `theseus.svg` alone unless told otherwise.
- [ ] **Step 2:** Do what they chose; confirm `git status --short` shows only what they expect.

---

### Task 1: Replace the Ruby project with a Node package

**Files:**
- Delete: `Gemfile`, `Gemfile.lock`, `Rakefile`, `.ruby-version`, `lib/`, `test/`, `bin/mmd-preview`
- Create: `package.json`, `test/smoke.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Remove the Ruby code**

```bash
git rm -rq Gemfile Gemfile.lock Rakefile .ruby-version lib test bin/mmd-preview
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "pele-preview",
  "version": "0.1.0",
  "description": "Preview or export a Mermaid diagram rendered by pele, with your own CSS embedded in the SVG.",
  "type": "module",
  "bin": { "pele-preview": "bin/pele-preview" },
  "files": ["bin", "src"],
  "engines": { "node": ">=20" },
  "scripts": { "test": "node --test" },
  "dependencies": { "pele": "^1.13.0" }
}
```

- [ ] **Step 3: Replace `.gitignore`** with:

```
node_modules/
.idea/
.DS_Store
/tmp/
```

- [ ] **Step 4: Install**

Run: `npm install`
Expected: creates `package-lock.json` and `node_modules/pele`, "found 0 vulnerabilities".

- [ ] **Step 5: Smoke test that pele loads** — `test/smoke.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "pele";

test("pele renders headless in node", () => {
  const { svg } = render("flowchart LR\n  A --> B");
  assert.match(svg, /^<svg /);
});
```

Run: `npm test`
Expected: `# pass 1`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add -A package.json package-lock.json .gitignore test/smoke.test.js
git commit -m "chore: Replace Ruby project with pele-preview Node package"
```

---

### Task 2: `compose` — render and embed CSS

**Files:**
- Create: `src/compose.js`, `test/compose.test.js`, `test/fixtures/flow.mmd`, `test/fixtures/broken.mmd`, `test/fixtures/theme.css`
- Delete: `test/smoke.test.js` (superseded)

- [ ] **Step 1: Fixtures**

`test/fixtures/flow.mmd`:
```
flowchart LR
  A[Mermaid text] --> B[SVG]
```

`test/fixtures/broken.mmd`:
```
flowchart LR
  A --> (((
```

`test/fixtures/theme.css`:
```css
.pele { --pele-surface: #eae7e7; --pele-accent: #205ea6; }
@media (prefers-color-scheme: dark) {
  .pele { --pele-surface: #383535; }
}
.pele-node > rect { stroke-width: 2px; }
```

- [ ] **Step 2: Write the failing tests** — `test/compose.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { render, PeleError } from "pele";
import { compose, readAndCompose, describeError } from "../src/compose.js";

const FLOW = "flowchart LR\n  A[Mermaid text] --> B[SVG]";
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

const hasXmllint = (() => {
  try { execFileSync("xmllint", ["--version"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();
const wellFormed = (xml) => execFileSync("xmllint", ["--noout", "-"], { input: xml, stdio: ["pipe", "ignore", "pipe"] });

test("without css, output is exactly pele's", () => {
  assert.equal(compose(FLOW, ""), render(FLOW).svg);
  assert.equal(compose(FLOW, "  \n"), render(FLOW).svg);
});

test("css becomes the first child of the root svg, in CDATA", () => {
  const svg = compose(FLOW, ".pele { --pele-accent: red; }");
  assert.match(svg, /^<svg [^>]*><style><!\[CDATA\[\n\.pele \{ --pele-accent: red; \}\n\]\]><\/style><g /);
});

test("css with XML-special characters stays well-formed", { skip: !hasXmllint && "xmllint not installed" }, () => {
  const css = ".pele-node > rect { fill: red; }\n/* a & b < c ]]> d */";
  const svg = compose(FLOW, css);
  assert.doesNotThrow(() => wellFormed(svg));
  assert.ok(svg.includes("]]]]><![CDATA[>"), "a literal ]]> is split so it cannot end the section");
});

test("font options reach pele", () => {
  assert.match(compose(FLOW, "", { fontFamily: "Georgia" }), /--pele-font,Georgia/);
  const width = (svg) => Number(svg.match(/width="([\d.]+)"/)[1]);
  assert.ok(width(compose(FLOW, "", { fontSize: 24 })) > width(compose(FLOW, "")));
});

test("invalid diagrams throw PeleError", () => {
  assert.throws(() => compose("flowchart LR\n  A --> (((", ""), PeleError);
});

test("readAndCompose reads both files", () => {
  const svg = readAndCompose({ diagram: fixture("flow.mmd"), stylesheet: fixture("theme.css") });
  assert.match(svg, /--pele-surface: #eae7e7/);
  assert.match(svg, /Mermaid text/);
});

test("readAndCompose works without a stylesheet", () => {
  const svg = readAndCompose({ diagram: fixture("flow.mmd"), stylesheet: null });
  assert.doesNotMatch(svg, /<style>/);
});

test("describeError gives file:line:column for syntax errors", () => {
  try { compose("flowchart LR\n  A --> (((", ""); }
  catch (e) { assert.match(describeError(e, "d.mmd"), /^d\.mmd:2:9: Parse error on line 2/); }
});

test("describeError omits position when pele has none", () => {
  try { compose("not a diagram", ""); }
  catch (e) { assert.equal(describeError(e, "d.mmd"), "d.mmd: No diagram type detected for the given text."); }
});

test("describeError passes other errors through", () => {
  assert.equal(describeError(new Error("EACCES: nope"), "d.mmd"), "EACCES: nope");
});
```

- [ ] **Step 3: Run to verify failure**

Run: `git rm -q test/smoke.test.js && npm test`
Expected: FAIL — `Cannot find module '…/src/compose.js'`.

- [ ] **Step 4: Implement** — `src/compose.js`:

```js
import { readFileSync } from "node:fs";
import { render, PeleError } from "pele";

// Renders a diagram with pele and embeds `css` inside the SVG, so the file
// carries its own styling wherever it is opened.
export function compose(mmd, css = "", { fontFamily, fontSize } = {}) {
  const options = {};
  if (fontFamily) options.fontFamily = fontFamily;
  if (fontSize) options.fontSize = fontSize;

  const { svg } = render(mmd, options);
  return css.trim() ? embed(svg, css) : svg;
}

export function readAndCompose({ diagram, stylesheet, fontFamily, fontSize }) {
  const css = stylesheet ? readFileSync(stylesheet, "utf8") : "";
  return compose(readFileSync(diagram, "utf8"), css, { fontFamily, fontSize });
}

export function describeError(error, file) {
  if (!(error instanceof PeleError)) return error.message;
  if (error.line > 0) return `${file}:${error.line}:${error.column}: ${error.message}`;
  return `${file}: ${error.message}`;
}

// CDATA keeps `>`, `&` and `<` in CSS from breaking the XML. A literal `]]>`
// would close the section early, so it is split across two sections.
function embed(svg, css) {
  const body = css.replaceAll("]]>", "]]]]><![CDATA[>");
  const rootTagEnd = svg.indexOf(">") + 1;
  return `${svg.slice(0, rootTagEnd)}<style><![CDATA[\n${body}\n]]></style>${svg.slice(rootTagEnd)}`;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all compose tests pass (`# fail 0`).

- [ ] **Step 6: Commit**

```bash
git add src/compose.js test/compose.test.js test/fixtures
git commit -m "feat: Compose pele SVG with embedded user CSS"
```

---

### Task 3: CLI argument parsing

**Files:**
- Create: `src/cli.js`, `test/cli.test.js`

- [ ] **Step 1: Write the failing tests** — `test/cli.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { parse, UsageError, HelpRequested } from "../src/cli.js";

const flow = new URL("./fixtures/flow.mmd", import.meta.url).pathname;
const css = new URL("./fixtures/theme.css", import.meta.url).pathname;

test("diagram only: preview defaults", () => {
  assert.deepEqual(parse([flow]), {
    diagram: flow, stylesheet: null, output: null, port: 0,
    open: true, browserApp: null, fontFamily: null, fontSize: null,
  });
});

test("stylesheet as second positional or -c", () => {
  assert.equal(parse([flow, css]).stylesheet, css);
  assert.equal(parse([flow, "-c", css]).stylesheet, css);
  assert.equal(parse([flow, "--css", css]).stylesheet, css);
});

test("-c plus a second positional is an error", () => {
  assert.throws(() => parse([flow, css, "-c", css]), (e) => e instanceof UsageError && /unexpected argument/.test(e.message));
});

test("-o resolves the output path; the file need not exist", () => {
  assert.equal(parse([flow, "-o", "out.svg"]).output, resolve("out.svg"));
});

test("all flags", () => {
  const o = parse([flow, "-p", "4000", "-n", "-B", "Google Chrome", "--font", "Georgia", "--font-size", "18"]);
  assert.equal(o.port, 4000);
  assert.equal(o.open, false);
  assert.equal(o.browserApp, "Google Chrome");
  assert.equal(o.fontFamily, "Georgia");
  assert.equal(o.fontSize, 18);
});

test("non-numeric port is a usage error", () => {
  assert.throws(() => parse([flow, "-p", "abc"]), UsageError);
});

test("missing diagram argument prints usage", () => {
  assert.throws(() => parse([]), (e) => e instanceof UsageError && /^usage: pele-preview/.test(e.message));
});

test("nonexistent files are usage errors", () => {
  assert.throws(() => parse(["nope.mmd"]), /no such file: nope\.mmd/);
  assert.throws(() => parse([flow, "nope.css"]), /no such file: nope\.css/);
});

test("unknown flags are usage errors", () => {
  assert.throws(() => parse([flow, "--theme", "dark"]), UsageError);
});

test("-h asks for help even without a diagram", () => {
  assert.throws(() => parse(["-h"]), HelpRequested);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/cli.test.js`
Expected: FAIL — cannot find `src/cli.js`.

- [ ] **Step 3: Implement** — `src/cli.js`:

```js
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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/cli.js test/cli.test.js
git commit -m "feat: Parse pele-preview command line"
```

---

### Task 4: File watcher

**Files:**
- Create: `src/watcher.js`, `test/watcher.test.js`

- [ ] **Step 1: Write the failing tests** — `test/watcher.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { watchFiles } from "../src/watcher.js";

const tempFile = () => {
  const path = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "d.mmd");
  writeFileSync(path, "a");
  return path;
};

test("a burst of writes produces one callback", async () => {
  const path = tempFile();
  let calls = 0;
  const watcher = watchFiles([path], () => calls++, { delay: 50 });
  try {
    await sleep(50);
    writeFileSync(path, "b");
    writeFileSync(path, "c");
    writeFileSync(path, "d");
    await sleep(300);
    assert.equal(calls, 1);
  } finally {
    watcher.close();
  }
});

test("keeps watching after an editor replaces the file by rename", async () => {
  const path = tempFile();
  let calls = 0;
  const watcher = watchFiles([path], () => calls++, { delay: 50 });
  try {
    await sleep(50);
    writeFileSync(`${path}.tmp`, "replaced");
    renameSync(`${path}.tmp`, path);
    await sleep(300);
    assert.ok(calls >= 1, "rename seen");

    const before = calls;
    writeFileSync(path, "edited again");
    await sleep(300);
    assert.equal(calls, before + 1, "write after rename seen");
  } finally {
    watcher.close();
  }
});

test("close stops callbacks", async () => {
  const path = tempFile();
  let calls = 0;
  watchFiles([path], () => calls++, { delay: 20 }).close();
  writeFileSync(path, "b");
  await sleep(150);
  assert.equal(calls, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/watcher.test.js`
Expected: FAIL — cannot find `src/watcher.js`.

- [ ] **Step 3: Implement** — `src/watcher.js`:

```js
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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# fail 0`. If the rename test is flaky on macOS, increase the sleeps (not the debounce) before changing the implementation.

- [ ] **Step 5: Commit**

```bash
git add src/watcher.js test/watcher.test.js
git commit -m "feat: Debounced watcher for diagram and stylesheet"
```

---

### Task 5: Preview server and page

**Files:**
- Create: `src/server.js`, `src/page.html`, `test/server.test.js`

- [ ] **Step 1: Write the failing tests** — `test/server.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.js";

const get = async (url) => {
  const res = await fetch(url);
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
};

test("serves page, diagram and state on loopback", async () => {
  const server = await startServer({ port: 0, render: () => "<svg>one</svg>" });
  try {
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.deepEqual(server.initial, { revision: 1, error: null });

    const page = await get(server.url);
    assert.equal(page.status, 200);
    assert.match(page.body, /EventSource\("\/events"\)/);

    const svg = await get(`${server.url}diagram.svg`);
    assert.equal(svg.type, "image/svg+xml; charset=utf-8");
    assert.equal(svg.body, "<svg>one</svg>");

    assert.deepEqual(JSON.parse((await get(`${server.url}state.json`)).body), { revision: 1, error: null });
    assert.equal((await get(`${server.url}nope`)).status, 404);
  } finally {
    await server.close();
  }
});

test("a failed render keeps the last good svg and reports the error", async () => {
  let fail = false;
  const server = await startServer({
    port: 0,
    render: () => { if (fail) throw new Error("boom"); return "<svg>good</svg>"; },
    describe: (e) => `d.mmd: ${e.message}`,
  });
  try {
    fail = true;
    const state = server.refresh();
    assert.equal(state.revision, 2);
    assert.equal(state.error, "d.mmd: boom");
    assert.equal((await get(`${server.url}diagram.svg`)).body, "<svg>good</svg>");
    assert.deepEqual(JSON.parse((await get(`${server.url}state.json`)).body), { revision: 2, error: "d.mmd: boom" });
  } finally {
    await server.close();
  }
});

test("refresh pushes the new revision to event listeners", async () => {
  let n = 0;
  const server = await startServer({ port: 0, render: () => `<svg>${++n}</svg>` });
  try {
    const res = await fetch(`${server.url}events`);
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    const reader = res.body.getReader();
    const next = async () => new TextDecoder().decode((await reader.read()).value);

    assert.equal(await next(), "data: 1\n\n");
    server.refresh();
    assert.equal(await next(), "data: 2\n\n");
    await reader.cancel();
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/server.test.js`
Expected: FAIL — cannot find `src/server.js`.

- [ ] **Step 3: Write the page** — `src/page.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pele-preview</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 13px system-ui, sans-serif; }
  #pp-error { display: none; margin: 0; padding: 12px 16px; white-space: pre-wrap;
              font: 12px ui-monospace, monospace; background: #fde8e8; color: #8a1c1c; }
  #pp-error.shown { display: block; }
  #pp-stage { padding: 24px; }
  #pp-stage.stale { opacity: .35; filter: grayscale(1); }
</style>
</head>
<body>
<pre id="pp-error"></pre>
<div id="pp-stage"></div>
<script type="module">
  // The page styles only its own chrome (ids prefixed pp-). The diagram's
  // styling arrives inside the SVG, exactly as it will ship.
  const stage = document.getElementById("pp-stage");
  const error = document.getElementById("pp-error");
  let shown = -1;

  async function update() {
    const state = await (await fetch("/state.json", { cache: "no-store" })).json();
    if (state.revision === shown) return;
    shown = state.revision;
    stage.innerHTML = await (await fetch(`/diagram.svg?rev=${state.revision}`)).text();
    error.textContent = state.error ?? "";
    error.classList.toggle("shown", Boolean(state.error));
    stage.classList.toggle("stale", Boolean(state.error));
  }

  new EventSource("/events").onmessage = update;
</script>
</body>
</html>
```

- [ ] **Step 4: Implement** — `src/server.js`:

```js
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PAGE = readFileSync(new URL("./page.html", import.meta.url));

// Serves the current render on 127.0.0.1. `render` returns an SVG string or
// throws; `describe` turns the thrown error into the text shown to the user.
// A failed render keeps the last good SVG on screen.
export function startServer({ port = 0, render, describe = (e) => e.message }) {
  const state = { revision: 0, svg: "", error: null };
  const listeners = new Set();

  const refresh = () => {
    try {
      state.svg = render();
      state.error = null;
    } catch (error) {
      state.error = describe(error);
    }
    state.revision += 1;
    for (const res of listeners) res.write(`data: ${state.revision}\n\n`);
    return { revision: state.revision, error: state.error };
  };

  const server = createServer((req, res) => {
    switch (new URL(req.url, "http://localhost").pathname) {
      case "/":
        return send(res, "text/html; charset=utf-8", PAGE);
      case "/diagram.svg":
        return send(res, "image/svg+xml; charset=utf-8", state.svg);
      case "/state.json":
        return send(res, "application/json", JSON.stringify({ revision: state.revision, error: state.error }));
      case "/events":
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
        res.write(`data: ${state.revision}\n\n`);
        listeners.add(res);
        req.on("close", () => listeners.delete(res));
        return;
      default:
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
    }
  });

  const initial = refresh();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/`,
        initial,
        refresh,
        close: () => new Promise((done) => {
          for (const res of listeners) res.end();
          server.close(done);
          server.closeAllConnections();
        }),
      });
    });
  });
}

function send(res, type, body) {
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/server.js src/page.html test/server.test.js
git commit -m "feat: Live preview server with SSE reload"
```

---

### Task 6: Browser opener

**Files:**
- Create: `src/browser.js`, `test/browser.test.js`

- [ ] **Step 1: Write the failing tests** — `test/browser.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { openCommand } from "../src/browser.js";

const url = "http://127.0.0.1:1/";

test("macOS uses open", () => {
  assert.deepEqual(openCommand(url, { platform: "darwin" }), ["open", url]);
});

test("a named app uses open -a", () => {
  assert.deepEqual(openCommand(url, { app: "Google Chrome", platform: "darwin" }), ["open", "-a", "Google Chrome", url]);
});

test("elsewhere uses xdg-open", () => {
  assert.deepEqual(openCommand(url, { platform: "linux" }), ["xdg-open", url]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/browser.test.js`
Expected: FAIL — cannot find `src/browser.js`.

- [ ] **Step 3: Implement** — `src/browser.js`:

```js
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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/browser.js test/browser.test.js
git commit -m "feat: Open the preview in a browser"
```

---

### Task 7: The `pele-preview` executable

**Files:**
- Create: `bin/pele-preview`, `test/bin.test.js`

- [ ] **Step 1: Write the failing tests** — `test/bin.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = new URL("../bin/pele-preview", import.meta.url).pathname;
const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

test("-o writes an svg with the stylesheet embedded", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "out.svg");
  const result = run(fixture("flow.mmd"), fixture("theme.css"), "-o", out);
  assert.equal(result.status, 0, result.stderr);
  const svg = readFileSync(out, "utf8");
  assert.match(svg, /^<svg [^>]*><style><!\[CDATA\[/);
  assert.match(svg, /--pele-surface: #eae7e7/);
});

test("a broken diagram exits 1 with its location", () => {
  const out = join(mkdtempSync(join(tmpdir(), "pele-preview-")), "out.svg");
  const result = run(fixture("broken.mmd"), "-o", out);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken\.mmd:2:9: Parse error/);
});

test("usage errors exit 2", () => {
  const result = run("missing.mmd");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no such file: missing\.mmd/);
});

test("--help prints usage and exits 0", () => {
  const result = run("--help");
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^usage: pele-preview/);
});

test("preview mode serves the composed svg", async () => {
  const child = spawn(process.execPath, [bin, fixture("flow.mmd"), fixture("theme.css"), "-n"]);
  try {
    const url = await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => {
        const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) resolve(match[0]);
      });
      child.on("exit", (code) => reject(new Error(`exited ${code}`)));
    });
    const svg = await (await fetch(`${url}diagram.svg`)).text();
    assert.match(svg, /--pele-surface: #eae7e7/);
  } finally {
    child.kill("SIGINT");
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/bin.test.js`
Expected: FAIL — `bin/pele-preview` not found.

- [ ] **Step 3: Implement** — `bin/pele-preview`:

```js
#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { parse, UsageError, HelpRequested } from "../src/cli.js";
import { readAndCompose, describeError } from "../src/compose.js";
import { startServer } from "../src/server.js";
import { watchFiles } from "../src/watcher.js";
import { launch } from "../src/browser.js";

const options = parseOrExit(process.argv.slice(2));
const render = () => readAndCompose(options);
const describe = (error) => describeError(error, options.diagram);

if (options.output) {
  exportSvg();
} else {
  await preview();
}

function parseOrExit(argv) {
  try {
    return parse(argv);
  } catch (error) {
    if (error instanceof HelpRequested) {
      console.log(error.message);
      process.exit(0);
    }
    if (error instanceof UsageError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }
}

function exportSvg() {
  try {
    writeFileSync(options.output, render());
    console.log(`wrote ${options.output}`);
  } catch (error) {
    console.error(describe(error));
    process.exit(1);
  }
}

async function preview() {
  let server;
  try {
    server = await startServer({ port: options.port, render, describe });
  } catch (error) {
    console.error(`could not start server: ${error.message}`);
    process.exit(1);
  }

  const report = ({ revision, error }) =>
    error ? console.error(error) : console.log(`rendered (revision ${revision})`);
  if (server.initial.error) console.error(server.initial.error);

  const files = [options.diagram, options.stylesheet].filter(Boolean);
  const watcher = watchFiles(files, () => report(server.refresh()));

  console.log(`pele-preview: ${server.url}  (Ctrl-C to stop)`);
  if (options.open) launch(server.url, { app: options.browserApp });

  process.once("SIGINT", async () => {
    watcher.close();
    await server.close();
    process.exit(0);
  });
}
```

Then make it executable:

```bash
chmod +x bin/pele-preview
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `# fail 0`.

- [ ] **Step 5: Manual check**

```bash
node bin/pele-preview test/fixtures/flow.mmd test/fixtures/theme.css
```
Expected: browser opens and shows the diagram. Edit `test/fixtures/theme.css` (e.g. `--pele-surface: hotpink`) and save; the page updates without a reload. Break `flow.mmd`; the error appears above a greyed diagram. Revert both, `Ctrl-C`.

```bash
node bin/pele-preview test/fixtures/flow.mmd test/fixtures/theme.css -o /tmp/flow.svg && open -a Safari /tmp/flow.svg
```
Expected: the standalone SVG shows the custom colors; switching macOS to dark mode switches them.

- [ ] **Step 6: Commit**

```bash
git add bin/pele-preview test/bin.test.js
git commit -m "feat: pele-preview executable with preview and export modes"
```

---

### Task 8: README

**Files:**
- Modify: `README.md` (full rewrite)

- [ ] **Step 1: Rewrite `README.md`** covering, in this order:
  1. One-paragraph intro and the two commands (preview, `-o` export).
  2. Requirements: Node ≥ 20. Install: `npm install && npm link` (or `npm i -g .`).
  3. Usage block — paste `USAGE` from `src/cli.js` verbatim.
  4. **Styling**: the CSS travels inside the SVG as a `<style>` element, and the preview page applies no styling of its own to the diagram. Two ways to style:
     - pele variables on `.pele` — list the main ones (`--pele-bg`, `--pele-fg`, `--pele-muted`, `--pele-line`, `--pele-surface`, `--pele-surface-alt`, `--pele-border`, `--pele-accent`, `--pele-critical`, `--pele-radius`, `--pele-font`, `--pele-font-mono`, `--pele-series-1…8`) and link https://pele.run/theming.
     - class selectors (`.pele-node`, `.pele-edge`, `.pele-label`, `.pele-cluster`, …) — beat pele's presentation attributes without `!important`.
     - `@media (prefers-color-scheme: dark)` works in the shipped file.
  5. **Gotchas**:
     - Fonts: pele measures labels in Node from a width table. If your CSS changes `--pele-font`, pass the same family with `--font` (and `--font-size`), or labels may not fit their boxes. Fonts are not embedded — viewers need them installed.
     - `rx` and other inline-style properties can only be changed through their variable (e.g. `--pele-radius`).
     - `style`/`classDef` in the diagram use fixed colors and ignore the theme.
     - If you paste the SVG into an HTML page, its `<style>` applies to the whole page; prefer `<img src>` or `<object>`.
  6. Development: `npm test`.

- [ ] **Step 2: Check every command in the README runs as written.**

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README for pele-preview"
```

---

### Task 9: Rename the GitHub repo and git remote

The remote is named `mermaid_preview` and points at `git@github.com:infews/mermaid_preview.git`.

- [ ] **Step 1: Confirm with the user** before renaming — it changes the public URL (GitHub redirects the old one).

- [ ] **Step 2: Rename on GitHub**

```bash
gh repo rename pele-preview -R infews/mermaid_preview --yes
```
Expected: `✓ Renamed repository infews/pele-preview`.

- [ ] **Step 3: Point the local remote at the new URL** (and rename the remote to match)

```bash
git remote set-url mermaid_preview git@github.com:infews/pele-preview.git
git remote rename mermaid_preview pele-preview
git remote -v
```
Expected: both lines show `pele-preview  git@github.com:infews/pele-preview.git`.

- [ ] **Step 4: Verify** — `git fetch pele-preview` succeeds.

---

### Task 10: Rename the local directory (user does this, last)

Renaming the directory moves the working directory out from under the running Claude Code session, so it is the final step and is done by the user after the session ends.

- [ ] **Step 1: Tell the user** to exit the session and run:

```bash
mv ~/workspace/mermaid_preview ~/workspace/pele-preview
cd ~/workspace/pele-preview && npm test
```

- [ ] **Step 2: Note for the user:** Claude Code keys project memory by path. To keep it, also run
`mv ~/.claude/projects/-Users-dwfrank-workspace-mermaid-preview ~/.claude/projects/-Users-dwfrank-workspace-pele-preview`
before starting a new session in the renamed directory.
