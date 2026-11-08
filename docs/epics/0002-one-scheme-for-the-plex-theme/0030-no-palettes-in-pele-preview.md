# No Palettes in pele-preview

## Narrative
As someone styling a diagram, I want my stylesheet to be the only place colors
come from, so that there is one scheme per stylesheet and nothing to choose.

## Acceptance Criteria
```gherkin
Feature: No palette option

  Scenario: --palette is gone
    When I run pele-preview DIAGRAM STYLE --palette paper
    Then it reports an unknown option with the usage text and exits 2
    And the usage text and --help no longer mention --palette

  Scenario: No Palette menu
    When I preview any diagram with any stylesheet
    Then the page shows only the Auto / Light / Dark toggle, with no Palette menu

  Scenario: Nothing marks a palette
    When I export or preview with any stylesheet, including one with [data-pele-scheme] rules
    Then no data-pele-scheme attribute is written into the SVG

  Scenario: The docs match
    Then the README has no Palettes section and never mentions --palette
```

Changes `EXPORT-E2E-003`: drop "and no `--palette`".

## EARS Specifications
- `EXPORT-E2E-003` (changed: no longer mentions `--palette`)
- `EXPORT-INV-006` (new)
- `CLI-E2E-009` (new)
- `CLI-INV-004` (new)

The Palette menu has no eval of its own: without `--palette`, `PREVIEW-E2E-004`
(the page shows what `-o` writes) covers it.

## Implementation Plan
- [x] Move bin's body into `src/main.js` (Export, Preview markers move with it) so it can be mutation tested; then drop `--palette` and the unknown-palette warning; remove the option from the README's usage block and delete the Palettes section and `test/bin.test.js`, which only tested `--palette`. (Arguments, Export) Makes `CLI-E2E-009` and `CLI-INV-004` pass.
  - Equivalent mutants in `src/main.js`: treating any parse error as a usage error (`parse` throws only `HelpRequested` or `UsageError`); skipping `watcher.close()` and `process.exit(0)` on Ctrl-C (the process exits 0 once the server and watchers close).
- [x] Delete `setPalette`, `palettesIn`, `PALETTE_NAME` and the palettes `readAndComposeAll` reports; drop the server's `?palette=` and palette state, and the page's Palette menu. Delete their internal tests and `test/fixtures/palettes.css`. (Compose, Preview)
  - Survivor outside the changed lines: `readAndComposeAll` passing no font options to pele (`src/compose.js`) goes unnoticed; `--font` and `--font-size` are removed in story 0040.

## Issues

- [x] **Development** — Mutation testing can't run on `bin/pele-preview`: Stryker has no parser for a file without a `.js` extension, so the Export and Preview entry points (and `npm run mutate`, whose config lists the file) have never been mutation tested. Task 1 changed that file. Options: (a) move bin's body into `src/main.js` with the `@subsystem Export` / `Preview` markers, leaving `bin/pele-preview` as a two-line shim, and fix `stryker.config.json`; (b) record that `bin/` is exempt, like CSS. I'd do (a) as a new first step of task 1: no behavior changes, and the CLI, EXPORT and PREVIEW evals guard it.
  - Answer: (a) — move bin's body into `src/main.js` (2026-11-08).
- [x] **Development** — Task 1 added a path check to `src/watcher.js` (Preview), and mutation testing that file leaves 13 survivors in code this story didn't change: redundant guards in `close()` (equivalent), the `fs.watch` error handler (untestable without faking `watch`), and a real gap — a retry already scheduled can re-attach a watcher after `close()`. Options: (a) mutation-test only the lines a task changes, record that rule in CLAUDE.md, and add a story to harden the watcher (inject `watch` for tests, close the re-attach gap); (b) harden the watcher now, inside this story. I'd do (a): it keeps this story about palettes, and the watcher work is real but separate.
  - Answer: (a) — mutation-test the lines a task changes; the watcher gets its own story, [Harden the file watcher](../0003-harden-pele-preview/0010-harden-the-file-watcher.md) (2026-11-08).
