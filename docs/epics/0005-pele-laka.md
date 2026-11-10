# pele-laka

## Vision
One theme, many diagrams. `pele-laka preview` gives a live view;
`pele-laka export` writes an SVG and a PNG ready for docs and slides, with
nothing to remember about output formats.

## Context
The project takes the name of one of Pele's sisters (PM, 2026-11-10). In
real use the stylesheet stays the same while the diagram changes, so the theme
should read as a setting (`-c`), not as a second positional argument. The PM
wants a PNG alongside every SVG, for slides and documents that can't take SVG.

PNG export draws the SVG in the user's installed Google Chrome. That ends the
README's "no headless browser" claim for PNG; the SVG and the preview still
need no browser beyond the one viewing the page.

## Scope
### In Scope
- Renaming the command, the package, the usage text, the preview's output and
  page, the README and `CLAUDE.md` to pele-laka. Earlier epics and stories keep
  "pele-preview" as history.
- Subcommands: `pele-laka preview -c STYLE DIAGRAM` and
  `pele-laka export -c STYLE DIAGRAM`. A bare `pele-laka DIAGRAM` is a usage
  error. The stylesheet positional is removed.
- Export writes `NAME.svg`, then `NAME.png`, next to the diagram, or in the
  directory given with `-o`.
- PNG from the installed Google Chrome at 2x, transparent background,
  `--scheme` applied, `auto` drawn light.
- Without Chrome, export writes the SVG only, warns, and exits 0.

### Out of Scope
- An alias for the old `pele-preview` command.
- Renaming the repo folder or the git remote.
- Exporting several diagrams in one run.
- Shipping or downloading a browser.
- A `--scale` option, a config file or an environment variable for the theme.

## Success Criteria
- `pele-laka preview -c theme.css a.mmd` previews as `pele-preview a.mmd theme.css` did.
- `pele-laka export -c theme.css a.mmd` writes `a.svg` and `a.png` beside `a.mmd`.
- `-o DIR` puts both files in DIR.
- On a machine without Chrome, the same command writes `a.svg`, warns about the PNG, and exits 0.

## Dependencies
Google Chrome installed on the development and test machine, for the PNG evals.

## Open Questions

## Resulting Stories
- [ ] [Rename to pele-laka](0005-pele-laka/0010-rename-to-pele-laka.md)
- [ ] [Preview and export subcommands](0005-pele-laka/0020-preview-and-export-subcommands.md)
- [ ] [Export also writes a PNG](0005-pele-laka/0030-export-also-writes-a-png.md)
