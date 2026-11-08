# Characterize Preview

## Narrative
As someone styling a diagram, I want a live preview that re-renders as I save and
shows exactly what export would write, so that I can iterate without exporting.

## Acceptance Criteria
```gherkin
Feature: Live preview in a browser

  Scenario: Starting a preview
    When I run pele-preview DIAGRAM STYLE
    Then it serves a page on 127.0.0.1 and prints "pele-preview: <url>  (Ctrl-C to stop)"
    And it opens the page in the default browser

  Scenario Outline: Preview options
    When I add <option>
    Then <result>

    Examples:
      | option             | result                                         |
      | -p 4000            | it serves on port 4000                         |
      | (no -p)            | it serves on a free port the OS picks          |
      | -n                 | it prints the URL and opens no browser         |
      | -B "Google Chrome" | it opens the page in Google Chrome             |

  Scenario: What the page shows
    Then the diagram on the page is the SVG that -o would write with the same --scheme
    And the diagram sits on its own --pele-bg (white unless the stylesheet sets it)

  Scenario: Live reload
    When I save the diagram or the stylesheet
    Then the page shows the new render without a reload, and the terminal prints "rendered (revision N)"
    And this still works after an editor saves by replacing the file

  Scenario: A broken render
    When I save a diagram with a syntax error
    Then the last good diagram stays on screen, greyed out, with the error above it
    And the terminal prints the error
    When I fix the diagram and save
    Then the page recovers

  Scenario Outline: The starting scheme
    When I run pele-preview DIAGRAM STYLE --scheme <scheme>
    Then the page shows the diagram exactly as -o with --scheme <scheme> would write it
    And with auto, the diagram and the page follow the browser's light or dark setting

    Examples:
      | scheme |
      | auto   |
      | light  |
      | dark   |

  Scenario: Stopping
    When I press Ctrl-C
    Then it exits 0

  Scenario: The server can't start
    Given the port is already in use
    When I run pele-preview DIAGRAM -p PORT
    Then it prints "could not start server: <reason>" and exits 1
```

## EARS Specifications
- `PREVIEW-CON-001`, `PREVIEW-CON-002`, `PREVIEW-CON-003`
- `PREVIEW-E2E-001` … `PREVIEW-E2E-015`
- `PREVIEW-INV-001`, `PREVIEW-INV-002`
- `PREVIEW-MON-001`

Not to be pinned: the Palette menu, `--palette` and the Auto / Light / Dark
toggle, which epic 0002 removes.

## Implementation Plan

## Issues

- [x] **Updating Evals** — `-B APP` runs `open -a APP URL` on every platform, but `open -a` exists only on macOS, so `-B` fails silently on Linux. Document `-B` as macOS-only, or make it run `APP URL` elsewhere (a fix story)? I'd document it.
  - Answer: macOS-only, documented; `--help` and the README now say so (2026-11-08).

- [x] **Adoption survey** — The README contradicts itself about the page's own colors. The Styling section says "The page is always light"; the Light and dark section says "The page's own colors follow the toggle". The code follows the toggle (commit 33b5645 came after 61d2914, which made it always light). Which is intended? I'd keep following the toggle and fix the Styling paragraph.
  - Answer: Keep following the toggle; README Styling paragraph fixed (2026-11-08).
