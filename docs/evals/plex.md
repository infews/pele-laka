# Plex theme

Area `PLEX`: `pele-plex.css`, the example theme, as it looks in a diagram
exported with it. Fonts, line widths, radius and weights are the stylesheet's
business and are not pinned. Tests: `test/evals/plex.test.js`.

## Invariants
- `PLEX-INV-002`: The README shall list every `--plex-edge-label-*` knob the theme defines, each with its default value.
- `PLEX-INV-003`: In light and dark, the text of a `solid` node, with any tone or none, shall have at least 4.5:1 contrast against its fill.
- `PLEX-INV-004`: In light and dark, the text of a node with `tone-N` shall have at least 4.5:1 contrast against its fill.
- `PLEX-INV-005`: In light and dark, the title of a subgraph with `tone-N` shall have at least 4.5:1 contrast against the subgraph's fill.
- `PLEX-INV-006`: In light and dark, the outline of every node and subgraph with `tone-N` shall have at least 3:1 contrast against the background.

## Contracts
- `PLEX-CON-001`: The theme shall set pele's color variables to the carbon values in the table below, for light and for dark.

  | Variable | Light | Dark |
  |---|---|---|
  | `--pele-bg` | `#ffffff` | `#161616` |
  | `--pele-fg` | `#161616` | `#f4f4f4` |
  | `--pele-fg-on-light` | `#161616` | `#161616` |
  | `--pele-fg-on-dark` | `#ffffff` | `#ffffff` |
  | `--pele-muted` | `#6f6f6f` | `#a8a8a8` |
  | `--pele-line` | `#525252` | `#a8a8a8` |
  | `--pele-surface` | `#f4f4f4` | `#262626` |
  | `--pele-surface-alt` | `#e0e0e0` | `#393939` |
  | `--pele-border` | `#8d8d8d` | `#6f6f6f` |
  | `--pele-accent` | `#0f62fe` | `#78a9ff` |
  | `--pele-critical` | `#da1e28` | `#ff8389` |
  | `--pele-error` | `#da1e28` | `#ff8389` |
  | `--pele-series-1` | `#6929c4` | `#8a3ffc` |
  | `--pele-series-2` | `#1192e8` | `#33b1ff` |
  | `--pele-series-3` | `#005d5d` | `#007d79` |
  | `--pele-series-4` | `#9f1853` | `#ff7eb6` |
  | `--pele-series-5` | `#fa4d56` | `#fa4d56` |
  | `--pele-series-6` | `#570408` | `#fff1f1` |
  | `--pele-series-7` | `#198038` | `#6fdc8c` |
  | `--pele-series-8` | `#002d9c` | `#4589ff` |

## End-to-end
- `PLEX-E2E-001`: Where `--scheme light` or `--scheme dark` is given, the diagram shall use that side of the theme whatever the viewer's setting.
- `PLEX-E2E-002`: While `--scheme` is `auto`, the diagram shall follow the viewer's light or dark setting.
- `PLEX-E2E-003`: Where the diagram is inside an element with `data-pele-mode="light"` or `"dark"`, it shall use that side of the theme whatever the viewer's setting.
- `PLEX-E2E-004`: A node with `tone-N` shall be filled with series color N mixed at 18% into the surface color.
- `PLEX-E2E-005`: A node with `tone-N` shall be outlined in series color N, with its text in the foreground color.
- `PLEX-E2E-006`: A node with `tone-N` and `solid` shall be filled and outlined in series color N.
- `PLEX-E2E-008`: A node with `solid` and no tone shall be filled and outlined in the accent color.
- `PLEX-E2E-009`: A subgraph with `tone-N` shall be filled, fully opaque, with series color N mixed at 9% into the background color.
- `PLEX-E2E-010`: A subgraph with `tone-N` shall be outlined in series color N.
- `PLEX-E2E-011`: A flowchart edge label shall be set in capitals, at 72% of the size pele laid it out at, tracked by 0.06em, at weight 500.
- `PLEX-E2E-012`: A flowchart edge label's box shall be a full pill, scaled about its center by 1.06 wide and 1.0 tall.
- `PLEX-E2E-013`: An edge label pele wraps onto two or more lines shall have its box scaled about its center by 1.14 wide and 1.18 tall.
- `PLEX-E2E-014`: A sequence diagram's message labels shall keep pele's own case, size, letter spacing and weight.
- `PLEX-E2E-015`: Where the stylesheet sets `--plex-tone-node-mix` or `--plex-tone-cluster-mix`, node or subgraph tints shall use that strength.
- `PLEX-E2E-016`: Where the stylesheet sets a `--plex-edge-label-*` knob, edge labels shall follow it instead of the default.
- `PLEX-E2E-017`: A node given the `hidden` class, by `:::hidden` or by a `class` line, shall not be drawn.
- `PLEX-E2E-018`: A subgraph given the `hidden` class by a `class` line shall not draw its box or title, while the nodes inside it are still drawn.

## Monitors

<!-- Retired, never reuse: PLEX-INV-001 (checks that removed features stay removed, PM 2026-11-08) -->
