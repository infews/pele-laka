# Adopt Specs of Theseus

## Vision
Write down what pele-preview already promises, as evals with tests, so any part of
it can be regrown later without changing what users rely on.

## Context
pele-preview works and is well tested (64 tests, ~97% line coverage), but its
spec lives in the README and in tests that mix public promises with internal
details. Nothing marks which behavior is fixed and which is free to change.

Survey findings (2026-11-08):

- **Edges:** the command line (arguments, messages, exit codes), the files it
  reads and writes, the preview page in a browser, and `pele-plex.css`. It
  depends on the `pele` library, `open` / `xdg-open`, and `fs.watch`. The HTTP
  routes (`/`, `/diagram.svg`, `/state.json`, `/events`) serve only our own page,
  so they are internal.
- **Coverage gaps:** the preview page has never run in a browser under test;
  `launch()` and the "could not start server" path are untested; the watcher
  tests are timing-based; `pele-plex.css` has no tests.
- **Areas:** `CLI` holds the argument rules shared by both modes; `EXPORT` owns
  `-o`; `PREVIEW` owns `-p`, `-n` and `-B`; `PLEX` is the theme,
  adopted as the first story of
  [One Scheme for the Plex Theme](0002-one-scheme-for-the-plex-theme.md), since
  that epic removes three of its four palettes.

Until every story here is done, the existing tests stand in for the missing
evals: they must keep passing, and no redesign may delete them.

## Scope
### In Scope
- Evals and eval tests for the current behavior of each area.
- Sorting the existing tests into eval tests and internal tests.
### Out of Scope
- New features or behavior changes, apart from answers to issues raised here.

## Success Criteria
Every area except `PLEX` has its evals in `docs/evals/`, every eval has a linked test,
`npm run evals` passes, and each existing test is either tagged `@spec` or
known to be internal.

## Dependencies
None.

## Open Questions

## Resulting Stories
- ~~[Characterize export](0001-adopt-specs-of-theseus/0010-characterize-export.md)~~
- ~~[Characterize the command line](0001-adopt-specs-of-theseus/0020-characterize-the-command-line.md)~~
- ~~[Characterize preview](0001-adopt-specs-of-theseus/0030-characterize-preview.md)~~
