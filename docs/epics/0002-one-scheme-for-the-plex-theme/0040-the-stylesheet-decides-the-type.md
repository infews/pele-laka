# The Stylesheet Decides the Type

## Narrative
As someone styling a diagram, I want the stylesheet alone to decide fonts and
text sizes, so that there are no command-line options that duplicate it or
silently do nothing.

## Acceptance Criteria
```gherkin
Feature: No font options

  Scenario: --font and --font-size are gone
    When I run pele-preview DIAGRAM STYLE with --font Georgia or --font-size 18
    Then it reports an unknown option with the usage text and exits 2
    And the usage text and --help no longer mention --font or --font-size

  Scenario: pele lays out at its default size
    When I export or preview any diagram
    Then pele lays the labels out at its default size and family

  Scenario: The stylesheet's font applies
    Given a stylesheet that sets --pele-font on .pele
    Then the diagram's text uses that family

  Scenario: The README explains sizing
    Then the README's Gotchas no longer tell me to match --font to my CSS
    And it explains that pele lays labels out at its default size, and that a
      stylesheet restyling text should scale relative to that size, as pele-plex.css does

  Scenario: The README documents the Plex edge labels
    Then the README's Plex section describes the edge-label styling
      (capitals, 72% size, tracking, pill, larger pill for wrapped labels, sequence messages untouched)
    And lists each --plex-edge-label-* knob with its default and what it changes
```

## EARS Specifications
- `CLI-E2E-010` (new)
- `CLI-INV-005` (new)
- `EXPORT-E2E-011` (new)
- `PLEX-INV-002` (new)

Already pinned: pele lays out at its default size and family, since
`EXPORT-E2E-003` and `EXPORT-INV-006` compare the output with pele's default
rendering.

## Implementation Plan
- [ ] Remove `--font` and `--font-size`: the options, their fields and the font plumbing into pele; their README usage lines; and the "Match the font you measure with" gotcha, replaced by how sizing works. (Arguments, Compose) Makes `CLI-E2E-010` and `CLI-INV-005` pass.
- [ ] Document the Plex edge labels in the README, with every `--plex-edge-label-*` knob and its default, and correct the theme's header comment on measuring. (PlexTheme comments) Makes `PLEX-INV-002` pass.

## Issues
