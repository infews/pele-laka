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

## Issues
