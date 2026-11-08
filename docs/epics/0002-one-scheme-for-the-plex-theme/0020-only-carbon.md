# Only Carbon

## Narrative
As someone copying the Plex theme, I want it to have one scheme with no
selector, so that there's nothing to choose and less to read.

## Acceptance Criteria
```gherkin
Feature: One color scheme

  Scenario: Carbon always applies
    Given a diagram exported with pele-plex.css
    Then it uses the carbon colors, with no data-pele-scheme attribute anywhere

  Scenario: The stylesheet defines no palettes
    Given pele-plex.css as the stylesheet
    Then the preview page shows no Palette menu

  Scenario: The docs match
    Then the README's Plex section and the theme's header comment
      describe a single scheme and never mention paper, harbor or moss
```

## EARS Specifications

## Implementation Plan

## Issues
