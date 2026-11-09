# Harden the File Watcher

## Narrative
As someone previewing a diagram, I want the preview to keep watching my files
reliably and to let go of them when it stops, so that saves are never missed and
nothing lingers after Ctrl-C.

## Acceptance Criteria
```gherkin
Feature: A reliable file watcher

  Scenario: Nothing is watched after stopping
    Given a preview whose diagram was just deleted, with a re-attach pending
    When the preview stops
    Then no file is watched afterwards, even when the diagram comes back

  Scenario: A watch error doesn't lose the file
    Given the operating system reports an error on a watched file
    Then the preview starts watching that file again
    And the next save still updates the page
```

Found by mutation testing `src/watcher.js` during story 0002/0030: 13
survivors, including the re-attach after `close()` and an untested `fs.watch`
error handler.

## EARS Specifications
- `PREVIEW-E2E-016` (new): one save, by writing or by rename, renders once. Fails today: a rename-save renders twice.
- `PREVIEW-E2E-017` (new): a diagram deleted and created again updates the page. Passes today.

Stopping and watch errors can't be reached from the CLI (Ctrl-C ends the process; the OS can't be made to report a watch error), so internal watcher tests cover them (developer decision, 2026-11-08).

## Implementation Plan
- [x] A rename-save re-attaches without reporting a second change (Preview: `src/watcher.js`). The rename event already reported the change, so the re-attach after it passes `retry = false`. A deleted file still reports when it comes back, because that path goes through the failed-attach retry. Makes PREVIEW-E2E-016 pass.
- [x] Regrow the watcher's stop and error paths (Preview: `src/watcher.js`). `watchFiles` takes a `watch` option, `fs.watch` by default, so tests can stand in a fake that emits `error`. First add internal tests: an error re-attaches and the next change still fires; `close()` with a re-attach pending watches nothing afterwards. Then fold the rename and error handlers into one `reattach(watcher, path, report)`. Drop the bookkeeping no test can notice: the `watchers.delete` in the error handler (closing an `FSWatcher` twice is harmless) and the `closed ||` guard (`close()` clears the timer). Scoped mutation testing on `src/watcher.js` must leave no survivors that aren't recorded as equivalent.

## Issues
