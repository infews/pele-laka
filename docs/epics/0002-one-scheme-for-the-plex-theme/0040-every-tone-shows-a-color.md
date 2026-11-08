# Every Tone Shows a Color

## Narrative
As a reader of a diagram, I want each of the eight tones to read as its own
color in light and dark, so that a tone-6 subgraph in dark mode doesn't look
like an untinted gray box.

## Acceptance Criteria
```gherkin
Feature: Distinct tones

  Scenario Outline: Every tone is a color
    Given pele-plex.css in <mode> mode
    Then each of the series colors 1 to 8 has an OKLCH chroma of at least 0.08

    Examples:
      | mode  |
      | light |
      | dark  |

  Scenario Outline: No two tones look alike
    Given pele-plex.css in <mode> mode
    Then every pair of series colors is at least 0.1 apart in OKLCH (ΔE OK)

    Examples:
      | mode  |
      | light |
      | dark  |
```

Today tone 6 in dark mode is `#fff1f1`, with a chroma of about 0.02.

## EARS Specifications

## Implementation Plan

## Issues
