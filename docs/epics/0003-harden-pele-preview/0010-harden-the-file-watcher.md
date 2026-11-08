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

## Implementation Plan

## Issues
