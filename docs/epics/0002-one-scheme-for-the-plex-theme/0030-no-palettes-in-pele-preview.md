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

## Implementation Plan

## Issues
