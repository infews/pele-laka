# One Scheme for the Plex Theme

## Vision
`pele-plex.css` is an example theme for anyone to copy and adapt. One well-made
scheme teaches more than four: it is easier to read, easier to change, and every
tone in it should be legible and distinct in both light and dark.

## Context
The theme ships four color schemes — carbon (the default), paper, harbor and
moss — selected with `[data-pele-scheme]`. Four schemes make the file long and
the README's instructions about choosing one complicated, for what is meant to
be an example.

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
- Update the README and the theme's header comment.
- Adopting the `PLEX` area (moved here from the adoption epic).
### Out of Scope
- `--palette` and the Palette menu in pele-preview: they stay, as general
  features for other stylesheets.
- Fonts, edge-label styling, and `data-pele-mode`.

## Success Criteria
- The theme has exactly one scheme, applied with no selector.
- Every tone and solid combination meets the contrast targets in both modes.
- All eight tones read as distinct colors in both modes.
- The README gives no palette instructions for the Plex theme.

## Dependencies
The adoption epic, so the rest of the system is pinned before this work starts.

## Open Questions

## Resulting Stories
- [Characterize the Plex theme](0002-one-scheme-for-the-plex-theme/0010-characterize-the-plex-theme.md)
- [Only carbon](0002-one-scheme-for-the-plex-theme/0020-only-carbon.md)
- [Readable text on tones](0002-one-scheme-for-the-plex-theme/0030-readable-text-on-tones.md)
- [Every tone shows a color](0002-one-scheme-for-the-plex-theme/0040-every-tone-shows-a-color.md)
