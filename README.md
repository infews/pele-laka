# pele-preview

Live browser preview of a [Mermaid](https://mermaid.js.org) diagram, rendered by
[pele](https://pele.run), with your own CSS. Point it at a `.mmd` file and it opens
a page that re-renders whenever you save the diagram or the stylesheet. When you
are happy, export the same thing as one self-contained SVG.

```sh
pele-preview docs/architecture.mmd theme.css                  # live preview
pele-preview docs/architecture.mmd theme.css -o diagram.svg   # export and exit
```

pele is a pure-JavaScript renderer, so there is no headless browser, no `mmdc`
and no puppeteer config to wrangle.

## Requirements and install

Node 20 or newer. That is all.

```sh
npm install && npm link      # or: npm i -g .
```

## Usage

```
usage: pele-preview DIAGRAM.mmd [STYLE.css] [options]

  -o, --output FILE    write a self-contained SVG to FILE and exit (no server)
  -c, --css FILE       stylesheet (same as the second positional argument)
  -p, --port N         port to serve on (default: ephemeral)
  -n, --no-open        don't open a browser, just print the URL
  -B, --browser APP    open in a specific app, e.g. "Google Chrome"
      --font FAMILY    font family pele measures labels with (default: sans-serif)
      --font-size N    font size pele measures labels with (default: 16)
      --scheme MODE    auto | light | dark (default: auto). With -o, light or
                       dark fixes the SVG to that scheme; auto follows the
                       viewer. In preview, the scheme the page starts on.
  -h, --help           show this message
```

Exit codes: `0` success, `1` render or I/O failure (export mode), `2` usage error.

A render that fails in preview mode leaves the last good diagram on screen,
greyed out, with the error above it. Fix the file and it recovers.

---

## Styling

Your CSS travels **inside the SVG**, as a `<style>` element, so the exported file
looks the same everywhere it is opened. The preview page applies no styling of
its own to the diagram beyond a background: what you see is what you ship. (The
page otherwise styles only its own chrome, the error banner and the padding
around the diagram.) The page is always light; it fills the diagram's area with `--pele-bg` (white unless your CSS
sets it), so a dark theme in your stylesheet still reads in the preview. The
exported SVG has no background of its own: set `--pele-bg` *and* paint it, e.g.
`.pele { background: var(--pele-bg, #fff); }`, if the file needs one.

pele's output has no `<style>` of its own. Its defaults are fallbacks written into
the root `<svg>`'s inline style, such as `--_s:var(--pele-surface,#f3f3f3)`, and
shapes read them through presentation attributes like `fill="var(--_s)"`. That
gives you two ways to style, and they combine freely.

### 1. Set pele's variables on `.pele`

```css
.pele { --pele-surface: #eae7e7; --pele-accent: #205ea6; }

@media (prefers-color-scheme: dark) {
  .pele { --pele-surface: #383535; }
}
```

| Variable | What it controls |
|---|---|
| `--pele-bg`, `--pele-fg` | background and text |
| `--pele-muted` | secondary text |
| `--pele-line` | edges and arrows |
| `--pele-surface`, `--pele-surface-alt` | node fills |
| `--pele-border` | node outlines |
| `--pele-accent`, `--pele-critical` | highlights and warnings |
| `--pele-radius` | corner radius |
| `--pele-font`, `--pele-font-mono` | text and monospace families |
| `--pele-series-1` ... `--pele-series-8` | chart series colors |

The full list, and which diagram types use which, is in the upstream
[theming docs](https://pele.run/theming).

### 2. Target pele's classes

`.pele-node`, `.pele-edge`, `.pele-label`, `.pele-cluster` and friends are
ordinary classes on ordinary SVG elements:

```css
.pele-node > rect { stroke-width: 2px; }
```

Because pele sets colors as presentation attributes, and any CSS rule beats a
presentation attribute, **a plain selector wins with no `!important`**.

### Light and dark

Write the dark side of your theme as `@media (prefers-color-scheme: dark)` (and,
if you like, the light side as `prefers-color-scheme: light`). Then pick how the
SVG uses it:

| `--scheme` | Exported SVG (`-o`) |
|---|---|
| `auto` (default) | carries both; follows the viewer's OS setting |
| `light` | always light, whatever the viewer's setting |
| `dark` | always dark, whatever the viewer's setting |

A web page cannot force `prefers-color-scheme`, so `light` and `dark` work by
rewriting your CSS as it is embedded: each `(prefers-color-scheme: dark)` becomes
a condition that is always true (`(min-width: 0px)`) or never true
(`(not (min-width: 0px))`), and the same for `light`. Your file on disk is never
changed.

The preview page has an **Auto / Light / Dark** toggle in the top-right corner;
`--scheme` picks where it starts. The page's own colors follow the toggle, and
each position shows exactly the SVG that `-o` with that `--scheme` would write.

Without a stylesheet there is nothing to switch: pele's defaults are a light
theme, so Dark shows the light diagram on a dark page.

---

## Gotchas

**Match the font you measure with.** pele sizes each label in Node, from a built-in
width table for one font family (default `sans-serif`, 16px). If your CSS sets
`--pele-font` to something with very different widths, labels will not fit their
boxes. Pass the same family to the renderer:

```sh
pele-preview flow.mmd theme.css --font "Helvetica" --font-size 14
```

`--font` sets pele's `fontFamily`, which lands in the SVG as
`font-family:var(--pele-font,<family>)`, so it is also the fallback when your CSS
does not set the variable. Fonts are never embedded: viewers need the family
installed.

**Some properties only move through their variable.** pele applies the corner
radius with an inline `style="rx:var(--_r)"`, and inline style beats any normal
stylesheet rule. `.pele-node rect { rx: 12px }` does nothing; set `--pele-radius`
instead of reaching for `!important`.

**`style` and `classDef` in the diagram ignore the theme.** They write fixed
colors, so `--pele-surface` will not reach a node that has one. Use them for
deliberate one-offs, or give the node a class and style that from your sheet:
`class A hot` in the diagram puts `hot` on the node's `<g>`, so
`.pele-node.hot > rect { fill: var(--pele-critical); }` follows the theme.

**Pasting the SVG into an HTML page leaks the styles.** The embedded `<style>`
applies to the *whole* document once the SVG is inline, so `.pele { ... }` rules
can hit other content. Prefer `<img src="diagram.svg">` or `<object>`, which keep
the stylesheet scoped to the SVG. (The preview page inlines the SVG, so the same
applies there: that is fine for previewing, but treat the exported file as the
truth.)

---

## Development

```sh
npm test
```
