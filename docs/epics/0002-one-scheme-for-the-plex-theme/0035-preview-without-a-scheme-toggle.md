# Preview Without a Scheme Toggle

## Narrative
As someone previewing a diagram, I want the page to show one scheme, the one I
chose, so that there's no control that seems to do nothing.

## Acceptance Criteria
```gherkin
Feature: One scheme in the preview

  Scenario: No toggle
    When I preview any diagram
    Then the page has no Auto / Light / Dark control

  Scenario: The scheme I chose
    When I run pele-preview DIAGRAM STYLE --scheme dark
    Then the page shows the diagram as -o --scheme dark would write it
    And the page around it is dark too, whatever my browser's setting

  Scenario: Following the browser
    When I run pele-preview DIAGRAM STYLE without --scheme, or with --scheme auto
    Then the diagram and the page follow my browser's light or dark setting
    And when I change that setting, they switch without a reload

  Scenario: The docs match
    Then the README describes --scheme for preview as above and never mentions the toggle
```

The PM saw the toggle leave the diagram's colors unchanged (2026-11-08). It
could not be reproduced in Chromium with `pele-plex.css` or the test theme;
removing the toggle makes the question moot.

## EARS Specifications
- `PREVIEW-INV-003` (new)

Already pinned: `PREVIEW-E2E-004` (the page shows what `-o` writes for the same
`--scheme`), `PREVIEW-E2E-005` (`auto` follows the browser without a reload) and
`PREVIEW-E2E-006` (`light` and `dark` win over the browser). The toggle itself
gets no test: removed features aren't tested (PM).

## Implementation Plan
- [x] Preview serves one SVG: it renders through `readAndCompose`, the same path as export; the server's `render` returns one SVG and drops `?scheme=`; the page loses the toggle but still takes its light or dark from `state.json`; delete `readAndComposeAll` and its tests. (Compose, Preview)
- [x] Remove the toggle from the README and say in `--help` that `--scheme` is the scheme the preview shows. (Arguments) Makes `PREVIEW-INV-003` pass.

## Issues
