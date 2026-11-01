# mmd-preview on pele — design

Date: 2026-11-01
Status: approved, pending implementation plan

## Goal

Replace the Ruby + mermaid-cli implementation with a Node (plain JavaScript,
ESM) CLI built on [pele](https://github.com/obsidianmd/pele). Given a `.mmd`
diagram and an optional `.css` file that adds to or overrides pele's defaults,
the tool either:

1. **previews** the diagram live in a browser, re-rendering on save, or
2. **exports** a self-contained SVG with the CSS embedded, ready to ship.

The Ruby code is deleted from this repo; git history keeps it.

## Background: how pele styles output

`pele.render(text, opts)` runs synchronously in Node ≥ 20 and returns
`{ svg, width, height, type, ... }`. The SVG has **no `<style>` element**.
Defaults live as fallbacks in the root element's inline style, e.g.
`--_s: var(--pele-surface, #f3f3f3)`, and shapes use presentation attributes
such as `fill="var(--_s)"`. Consequences:

- Setting `--pele-*` custom properties on `.pele` (or an ancestor) re-themes the
  diagram.
- Ordinary CSS rules (e.g. `.pele-node rect { fill: … }`) beat presentation
  attributes without `!important`.
- Properties pele sets in inline `style` attributes (e.g. `rx` via
  `--pele-radius`) can only be changed through their variable.
- In Node, text is measured from a built-in width table for `fontFamily`
  (default `sans-serif`, 16px). A CSS font far from that will mis-size labels,
  so the font is passed to `render()` explicitly.

## Command line

```
mmd-preview DIAGRAM.mmd [STYLE.css] [options]

  -o, --output FILE    write a self-contained SVG to FILE and exit (no server)
  -c, --css FILE       stylesheet (same as the second positional argument)
  -p, --port N         port to serve on (default: ephemeral)
  -n, --no-open        don't open a browser, just print the URL
  -B, --browser APP    open in a specific app, e.g. "Google Chrome"
      --font FAMILY    font family pele measures labels with (default: sans-serif)
      --font-size N    font size pele measures labels with (default: 16)
  -h, --help           show usage
```

Removed from the Ruby version: `--theme`, `--background` (both are CSS
variables now).

Exit codes: `0` success, `1` render or I/O failure (export mode), `2` usage
error.

## Architecture

All rendering happens in Node. Preview and export share one function, so the
preview shows exactly the bytes that export writes.

```
bin/mmd-preview          entry; owns process exit and error printing
src/cli.js               argv → options object; throws UsageError / HelpRequested
src/compose.js           compose(mmd, css, renderOpts) → svg string
src/server.js            loopback http server: page, diagram, SSE reload stream
src/watcher.js           watches the two input files, debounced change callback
src/browser.js           opens a URL with open / xdg-open (or open -a APP)
src/page.html            preview page
test/*.test.js           node:test
```

### compose.js

`compose(mmdText, cssText, { fontFamily, fontSize })`:

1. `render(mmdText, { fontFamily, fontSize })` from `pele`.
2. If `cssText` is non-empty, insert
   `<style><![CDATA[\n…css…\n]]></style>` as the first child of the root
   `<svg>`. CDATA keeps the file valid XML when CSS contains `>`, `&` or `<`.
   A literal `]]>` in the CSS is split (`]]]]><![CDATA[>`) so it cannot close
   the section early.
3. Return the string. `PeleError` propagates unchanged.

Pure function, no I/O — the core of the tool.

### Export mode

Read both files, `compose`, write `--output`. On `PeleError` print
`file:line:column: message` plus pele's snippet and exit 1.

### Preview mode

- `server.js` binds `127.0.0.1` on `--port`. Routes:
  - `GET /` — `page.html`
  - `GET /diagram.svg` — current composed SVG (re-read and re-composed from disk
    on each change, cached between changes)
  - `GET /state.json` — `{ revision, error }` where error is null or
    `{ message, line, column, snippet }`
  - `GET /events` — Server-Sent Events; sends `revision` on each re-render
- `watcher.js` uses `fs.watch` on the two files (not their directories),
  debounced ~100ms, and re-attaches after editors that replace files via
  rename.
- On change: re-read both files, try `compose`. Success replaces the cached SVG
  and clears the error. Failure keeps the last good SVG and records the error.
  Revision increments either way.
- `page.html` inlines the SVG into the page (so `prefers-color-scheme` follows
  the viewer), listens on `/events`, re-fetches on each revision, and on error
  shows the message above the last good diagram, greyed out. The page adds no
  CSS that targets the diagram; the user's CSS travels only inside the SVG.
- Prints the URL; opens a browser unless `--no-open`. `Ctrl-C` closes the server
  and watchers.

## Error handling

- Missing / unreadable input files → usage error before anything starts.
- Render errors → export exits 1 with location; preview shows them in-page and
  on stderr, keeps serving.
- No browser opener available → not an error; URL is already printed.

## Testing

`node:test` + `node:assert`, no test dependencies. `npm test` runs them.

- `compose`: uses real pele. CSS lands as first child of `<svg>`; output parses
  as well-formed XML (`xmllint --noout`, which macOS ships; the test skips
  if it is absent); CSS with
  `>`/`&`/`]]>` survives; empty CSS adds no `<style>`; font options reach
  pele (label widths change); invalid diagrams throw `PeleError`.
- `cli`: positional vs `-c`, `-o`, flags, unknown flags, missing files, help.
- `server`: start on port 0, fetch each route, simulate a change and assert the
  SSE event and new revision; error state keeps the last good SVG.
- `watcher`: write to a temp file, expect one debounced callback.

## Packaging

`package.json`: `"type": "module"`, `"bin": { "mmd-preview": "bin/mmd-preview" }`,
`"engines": { "node": ">=20" }`, single dependency `pele`. Install with
`npm i -g .` or run with `npx`.

Delete: `Gemfile`, `Gemfile.lock`, `Rakefile`, `.ruby-version`, `lib/`, Ruby
`test/`. Update `.gitignore` for `node_modules/`. Rewrite `README.md` around
the pele styling model (variables, class selectors, inline-style limits, font
measurement).

## Out of scope

- Rendering in a browser for exact font metrics.
- Scoping embedded CSS when the shipped SVG is later inlined into another HTML
  page (the `<style>` will apply page-wide there; documented in README).
- PNG/PDF output.
