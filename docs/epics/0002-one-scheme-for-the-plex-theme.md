# One Scheme for the Plex Theme

## Vision
`pele-plex.css` is an example theme for anyone to copy and adapt. One well-made
scheme teaches more than four: it is easier to read, easier to change, and every
tone in it should be legible and distinct in both light and dark.

Each stylesheet has one color scheme, and the stylesheet alone decides colors
and type: pele-preview stops offering palettes and font options of its own.

## Context
The theme ships four color schemes — carbon (the default), paper, harbor and
moss — selected with `[data-pele-scheme]`. Four schemes make the file long and
the README's instructions about choosing one complicated, for what is meant to
be an example.

pele-preview supports this with `--palette` and a Palette menu, and offers
`--font` and `--font-size`. In Node, pele lays labels out the same for every font
family; only the size changes the layout. So `--font` only names a fallback the
stylesheet's `--pele-font` already overrides, and the README's "Match the font you
measure with" advice is wrong. A stylesheet can restyle text relative to the
size pele laid it out at, as `pele-plex.css` does for edge labels.

Measured against carbon today (2026-11-08):

- Text on tinted nodes is fine everywhere (≥ 7.9:1); outlines all clear 3:1
  against the background.
- Solid-tone text is below 4.5:1 for tones 2 and 5 in light mode and tones 1
  and 3 in dark.
- Subgraph titles are below 4.5:1 for tones 2, 5 and 7 in light mode and tones
  1 and 3 in dark.
- Tone 6 in dark mode is `#fff1f1`, nearly white, so a tone-6 subgraph tints
  gray rather than a color.

## Scope
### In Scope
- Keep carbon; remove paper, harbor, moss and the `[data-pele-scheme]` selector,
  so carbon simply applies.
- Meet the contrast and distinctness targets in both light and dark modes.
- Remove `--palette`, the preview's Palette menu, and `data-pele-scheme` handling
  from pele-preview.
- Remove the preview's Auto / Light / Dark toggle: the page shows the scheme
  chosen with `--scheme`, and `auto` follows the browser.
- Remove `--font` and `--font-size`; pele lays out at its default size.
- Update the README and the theme's header comment, including how the theme
  styles edge labels.
- Adopting the `PLEX` area (moved here from the adoption epic).
### Out of Scope
- Changing the theme's fonts, edge-label styling, or `data-pele-mode`.
- Reading a font size from the stylesheet.

## Success Criteria
- The theme has exactly one scheme, applied with no selector.
- Every tone and solid combination meets the contrast targets in both modes.
- All eight tones read as distinct colors in both modes.
- pele-preview has no palette or font options; the README gives no palette
  instructions and explains how sizing and the Plex edge labels work.

## Dependencies
The adoption epic, so the rest of the system is pinned before this work starts.

## Open Questions

## Resulting Stories
- ~~[Characterize the Plex theme](0002-one-scheme-for-the-plex-theme/0010-characterize-the-plex-theme.md)~~
- ~~[Only carbon](0002-one-scheme-for-the-plex-theme/0020-only-carbon.md)~~
- ~~[No palettes in pele-preview](0002-one-scheme-for-the-plex-theme/0030-no-palettes-in-pele-preview.md)~~
- ~~[Preview without a scheme toggle](0002-one-scheme-for-the-plex-theme/0035-preview-without-a-scheme-toggle.md)~~
- [The stylesheet decides the type](0002-one-scheme-for-the-plex-theme/0040-the-stylesheet-decides-the-type.md)
- [Readable text on tones](0002-one-scheme-for-the-plex-theme/0050-readable-text-on-tones.md)
- [Every tone shows a color](0002-one-scheme-for-the-plex-theme/0060-every-tone-shows-a-color.md)
