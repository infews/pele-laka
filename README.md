# pele-laka

Live browser preview of a [Mermaid](https://mermaid.js.org) diagram, rendered by [Pele](https://pele.run), with your own CSS. Point it at a `.mmd` file and it opens a live preview web page that re-renders whenever you save the diagram or the stylesheet. When you are happy, export the same diagram as one self-contained SVG, and a PNG of it.

```sh
pele-laka preview -c theme.css docs/architecture.mmd           # live preview
pele-laka export -c theme.css docs/architecture.mmd            # writes docs/architecture.svg and .png
pele-laka export -c theme.css -o build docs/architecture.mmd   # writes build/architecture.svg and .png
```

Pele is a pure-JavaScript renderer, built as part of the [Obsidian](https://obsidian.md) project, so the SVG and the preview need no headless browser, no `mmdc` and no puppeteer config to wrangle. Only the PNG needs a browser: it is the SVG drawn by your installed Google Chrome, at twice its size, on a transparent background.

## Why Pele Laka?

- IDEs/Editors don't seem to keep up with Mermaid's main project. I wanted something standalone.
- Pele
  - is smaller and faster than Mermaid.
  - doesn't have a CLI, so someone had to build one.
  - has more customizable theming than Mermaid.
- Better SVG portability: the CSS/Theme _inside_ the exported SVG.
- Bonus Theme features in included stylesheets:
  - Two included themes 
  - Colors for use in flowcharts
  - Different styling for edges (all caps, mono font, borders)

## Requirements and install

Node 20 or newer. For the PNG, Google Chrome, in its usual place (`/Applications` on macOS, `google-chrome` on the PATH on Linux); set `CHROME_PATH` to use one somewhere else. Without Chrome, `export` writes the SVG, says it skipped the PNG, and still succeeds.

```sh
npm install && npm link      # or: npm i -g .
```

## Usage

```
usage: pele-laka preview [options] DIAGRAM.mmd
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

export (writes NAME.svg, then NAME.png; the PNG needs Google Chrome):
  -o, --output DIR     write into DIR instead of next to the diagram
```

Exit codes: `0` success, `1` render or I/O failure, or the preview server could not start, `2` usage error.

A render that fails in preview mode leaves the last good diagram on screen, greyed out, with the error above it. Fix the file and it recovers.


### Light and dark

`--scheme` decides which side of your stylesheet the SVG, the preview and the PNG use. Write the dark side as `@media (prefers-color-scheme: dark)` (and, if you like, the light side as `prefers-color-scheme: light`):

| `--scheme` | Exported SVG and preview | PNG |
|---|---|---|
| `auto` (default) | carries both; follows the viewer's OS or browser setting | light |
| `light` | always light | light |
| `dark` | always dark | dark |

`light` and `dark` work by rewriting those media queries in the copy of the CSS embedded in the SVG; your file on disk is never changed. With `auto`, change your browser's or OS's light/dark setting to see the other side in the preview, without a reload.

### Your CSS goes inside the SVG

The stylesheet is embedded in the SVG as a `<style>` element, so the exported file looks the same wherever it is opened. The preview adds nothing to the diagram but a background: what you see is what you ship. The exported SVG has no background of its own; set `--pele-bg` *and* paint it, e.g. `.pele { background: var(--pele-bg, #fff); }`, if the file needs one.

How to write a theme, with pele's variables and classes, is in pele's [theming docs](https://pele.run/theming).

---

## The Included Stylesheets

pele-laka comes with two stylesheets that add features pele doesn't have: tones for flowcharts, a `hidden` class, and styled edges. Both use IBM Carbon's neutrals and categorical palette, in light and dark, and differ only in their fonts:

| Stylesheet | Fonts |
|---|---|
| `pele-plex.css` | IBM Plex Sans; IBM Plex Mono for edge labels |
| `pele-noto.css` | Noto Sans and Noto Color Emoji; Noto Sans Mono for edge labels |

Use one as is, or copy it as a starting point for your own:

```sh
pele-laka preview -c pele-plex.css diagram.mmd
```

### Tones for Flowcharts

The Mermaid eight series colors are available as classes named `tone-1` … `tone-8`. You don't need any `classDef` lines in your diagram. Instead, you can rely on the CSS to color your nodes. This is especially helpful for keeping multiple related diagrams consistently themed. 

| Target | Syntax |
|---|---|
| One node | `A[Text]:::tone-1` |
| Several nodes | `class A,B,C tone-2` |
| A subgraph | `class SubgraphId tone-3` (use the subgraph's id) |
| Solid fill on a node | Give it a tone, then add `class A solid` on its own line |

```
flowchart LR
  A[Ingest]:::tone-1 --> B{Valid?}:::tone-2
  B --> C[(Store)]
  B --> D[Alert]:::tone-4

  subgraph Pipeline
    C
  end

  class C tone-3
  class D solid
  class Pipeline tone-6
```

| Class | Fill | Outline | Text |
|---|---|---|---|
| `tone-N` on a node | 18% tint of the color | Full color | Normal foreground |
| `tone-N` + `solid` | Full color | Full color | Near-black or white, whichever reads better on that tone |
| `tone-N` on a subgraph | 9% tint, opaque | Full color | Title in the color, 25% toward the foreground |

The tint strengths are adjustable with `--plex-tone-node-mix` and `--plex-tone-cluster-mix`, and how much of the color is in a subgraph's title with `--plex-tone-title-mix` (75%).

1. **One class per `:::`.** `A:::tone-4:::solid` is a parse error.
2. **Subgraphs can't use `:::`.** Apply the class with a `class` line instead.
3. **One class per `class` line.** That's why `solid` needs its own line, separate from the tone.
4. **Colors follow the theme.** Tones read the current scheme's `--pele-series-1…8`, so they change with `--scheme` and with light/dark mode without re-rendering.
5. **Avoid `classDef` and `style` for these.** Colors set that way are fixed hex values that don't change with the theme, and they override the tone on that node. Mermaid's parser rejects `var(...)`, so they can't reference theme colors.
6. **`solid` without a tone** falls back to the scheme's accent color.
7. **Moved subgraph titles keep the default color.** If a subgraph's title would cross an edge, pele draws it outside the subgraph's group, so the tone class doesn't reach it.

### Hiding Nodes and Subgraphs

The `hidden` class removes a node from view while it still takes part in the layout. This is useful for String Diagrams (where nodes are verbs and edges are nouns), or when you need a handy as a spacer:

```
flowchart LR
  A[Shown] ~~~ S[Spacer]:::hidden
  S ~~~ B[Also shown]

  subgraph Lane
    B
  end
  class Lane hidden
```

- **Nodes:** `A:::hidden` or `class A hidden`.
- **Subgraphs:** `class Lane hidden` hides the box and title only. The nodes inside are still drawn; hide them with their own class line if you want.
- **Edges** can't be hidden: an edge into a hidden node is still drawn. Join hidden nodes with Mermaid's invisible link, `~~~`, which draws nothing.

### Improved Readbility for Edge Labels

Edge lines are heavier than pele's: 1.75px, and 3.25px for thick (`==>`) edges, with arrowheads and dots scaled to match. Set `--plex-edge-width` and `--plex-edge-width-thick` to change them.

Labels on flowchart edges are set in small tracked capitals, in the stylesheet's monospace font, inside a pill, so they read as tags rather than as more node text. Each step is relative to the box and size pele laid the label out at:

- the text is set in the monospace font (`--pele-font-mono`), shrinks to 72% (capitals, tracking and the monospace font make it wider), is tracked out, and set at weight 500;
- the box grows around its own center to fit, into a full pill;
- a label pele wraps onto two or more lines gets a little more room, and its box reads as a rounded rectangle;
- sequence-diagram messages are left as pele draws them.

Every step is a knob you can set on `:root` (or any ancestor of the diagram):

| Knob | Default | What it changes |
|---|---|---|
| `--plex-edge-label-scale` | `0.72` | text size, as a share of the size pele laid it out at (capitals need about 0.78 or less) |
| `--plex-edge-label-tracking` | `0.06em` | letter spacing |
| `--plex-edge-label-weight` | `500` | font weight |
| `--plex-edge-label-pad-x` | `1.06` | pill width, as a factor of pele's box |
| `--plex-edge-label-pad-x-wrapped` | `1.14` | pill width for wrapped labels |
| `--plex-edge-label-pad-y` | `1.0` | pill height, as a factor of pele's box |
| `--plex-edge-label-pad-y-wrapped` | `1.18` | pill height for wrapped labels |
| `--plex-edge-label-radius` | unset: a full pill | corner radius, for a soft-cornered tag instead |
| `--plex-edge-label-stroke-width` | `1px` | outline width |
| `--plex-edge-label-fg` | unset: `--pele-fg` | text color |
| `--plex-edge-label-bg` | unset: `--pele-bg` | fill |
| `--plex-edge-label-border` | unset: `--pele-border` | outline color |
