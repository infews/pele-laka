# Export Also Writes a PNG

## Narrative
As a user putting diagrams in slides and documents, I want export to write a
PNG beside the SVG, so that I have both formats without a second step.

## Acceptance Criteria
```gherkin
Feature: PNG export

  Scenario: SVG, then PNG
    Given Google Chrome is installed
    When I run "pele-laka export -c theme.css docs/a.mmd"
    Then docs/a.svg is written first, then docs/a.png
    And stdout shows "wrote <path>" for each, SVG first
    And the command exits 0

  Scenario: What the PNG looks like
    Then a.png is the SVG drawn by Chrome at twice its width and height
    And pixels outside the diagram's shapes are transparent

  Scenario: The PNG follows --scheme
    When I export with "--scheme dark"
    Then a.png is drawn dark
    When I export with "--scheme light", "--scheme auto" or no --scheme
    Then a.png is drawn light

  Scenario: -o puts the PNG with the SVG
    When I export with "-o out"
    Then out/a.svg and out/a.png are written

  Scenario: No Chrome
    Given Google Chrome isn't installed
    When I export
    Then a.svg is written
    And stderr shows "skipped <path to a.png>: PNG export needs Google Chrome"
    And no a.png is written
    And the command exits 0

  Scenario: Chrome fails while drawing
    Given Chrome is installed but drawing the PNG fails
    Then a.svg is kept
    And stderr shows the error
    And the command exits 1

  Scenario: The diagram doesn't render
    When the diagram has a syntax error
    Then neither a.svg nor a.png is written or changed
```

## EARS Specifications
- `EXPORT-CON-004` (new): Chrome runs from `CHROME_PATH` when set, otherwise from its standard install location.
- `EXPORT-E2E-016` (new): after the SVG, `NAME.png` beside it, drawn by Chrome at 2x.
- `EXPORT-E2E-017` (new): the PNG is transparent wherever the SVG draws nothing.
- `EXPORT-E2E-018` (new): `--scheme dark` draws the PNG dark; `light`, `auto` or none draws it light.
- `EXPORT-E2E-019` (new): no Chrome writes the SVG, prints `skipped <path>: PNG export needs Google Chrome`, exit 0.
- `EXPORT-E2E-020` (new): Chrome failing keeps the SVG, leaves an existing PNG unchanged, prints `<path>: MESSAGE` with Chrome's own error in it, exit 1.
- `EXPORT-E2E-002`, `-009`, `-010`, `-012`, `-014`, `-015` (changed): `wrote` for the SVG then the PNG; render and SVG-write failures write no PNG; `-o DIR`, replacing and `would overwrite` cover the PNG too.

Eval tests that only check the SVG run with `CHROME_PATH` pointing at a missing file, so they stay fast and don't need Chrome; what they check is unchanged.

## Implementation Plan
Smallest change: `parse` adds a `png` path beside `svg` and checks it for
`would overwrite`; `exportSvg` in `main.js` then finds Chrome, draws the SVG in
it with `playwright-core` (the library alone, no bundled browsers) and writes
the PNG.

Regrow: extract the Export subsystem from `main.js` into `src/export.js`, as
0020 planned, and give drawing its own subsystem, PNG (`src/png.js`): find
Chrome (`CHROME_PATH`, else the standard install location) and turn an SVG into
PNG bytes. Export stays in charge of order, messages and exit codes; PNG knows
only Chrome. Two choices keep the PNG predictable:
- it draws the SVG composed with `light` unless `--scheme dark`, so `auto`
  is light whatever Chrome or the OS prefers;
- it writes the file only after Chrome hands back every byte, so a failure
  leaves an old PNG as it was.

`playwright-core` becomes a shipped dependency, pinned to the version the
tests' `playwright` already uses.

- [x] Extract Export (Export: `src/main.js` → `src/export.js`, marker moves). No behavior change; `main.js` only dispatches. Every eval that passes now still passes.
- [ ] The PNG's path (Arguments: `src/cli.js`). Export's options gain `png`, `NAME.png` beside `svg`; a `png` equal to the diagram or the stylesheet is `would overwrite <path>`. Makes EXPORT-E2E-015 pass.
- [ ] Find Chrome, or skip the PNG (PNG: `src/png.js`, new; Export). `CHROME_PATH` when set, else `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS or `google-chrome` on the PATH on Linux. Not found: `skipped <png>: PNG export needs Google Chrome`, exit 0. Makes EXPORT-E2E-019 pass.
- [ ] Draw the PNG (PNG, Export; `package.json` gains `playwright-core`). Launch Chrome from the found path, light color scheme, device scale 2, transparent background; screenshot the root `<svg>`; write `NAME.png` and print `wrote <png>` after the SVG. A failure prints `<png>: MESSAGE` with Chrome's error and exits 1. Makes EXPORT-CON-004, -E2E-002, -012, -014, -016, -017, -018 and -020 pass.
- [ ] Docs. The README drops "no headless browser" for PNG, says what export writes and that PNG needs Google Chrome (or `CHROME_PATH`); `CLAUDE.md` notes the PNG evals need Chrome. The usage line for `export` says it writes the SVG and the PNG, in both `USAGE` and the README (CLI-INV-003).

## Issues
