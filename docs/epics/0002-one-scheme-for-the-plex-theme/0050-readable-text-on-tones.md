# Readable Text on Tones

## Narrative
As a reader of a diagram, I want the text on colored nodes and the titles of
colored subgraphs to be legible in light and dark, so that coloring a diagram
never makes it harder to read.

## Acceptance Criteria
```gherkin
Feature: Contrast on tones

  Scenario Outline: Tone contrast in each mode
    Given a diagram exported with pele-plex.css and --scheme <mode>
    And a solid node, a tinted node and a subgraph, each with class tone-<n>
    Then the solid node's text has at least 4.5:1 contrast against its fill
    And the tinted node's text has at least 4.5:1 contrast against its fill
    And the subgraph's title has at least 4.5:1 contrast against its fill
    And every outline has at least 3:1 contrast against the background

    Examples:
      | mode  | n |
      | light | 1 |
      | light | 2 |
      | light | 3 |
      | light | 4 |
      | light | 5 |
      | light | 6 |
      | light | 7 |
      | light | 8 |
      | dark  | 1 |
      | dark  | 2 |
      | dark  | 3 |
      | dark  | 4 |
      | dark  | 5 |
      | dark  | 6 |
      | dark  | 7 |
      | dark  | 8 |

  Scenario: Solid without a tone
    Given a node with class solid only, in light and in dark
    Then its text has at least 4.5:1 contrast against its fill
```

Contrast is the WCAG 2 ratio, computed from the colors the browser resolves.
Today these fail: solid text for tones 2 and 5 (light) and 1 and 3 (dark);
subgraph titles for tones 2, 5 and 7 (light) and 1 and 3 (dark).

## EARS Specifications
- `PLEX-INV-003`, `PLEX-INV-004`, `PLEX-INV-005`, `PLEX-INV-006` (new; contrast is the WCAG 2 ratio of the colors the browser resolves)
- `PLEX-E2E-010` (changed: pins the outline only, not the title's color)
- `PLEX-E2E-007` (retired: solid text is no longer always the background color)

Approach (PM, 2026-11-08): keep carbon's colors (`PLEX-CON-001` unchanged) and
choose the text: solid text is near-black or white, whichever reads better on
the tone; subgraph titles are the tone mixed toward the foreground.

## Implementation Plan
- [x] Give each tone an "on" color for text set on it (near-black or white, per tone and mode) and use it for solid labels and detail lines; update the README's "What each one looks like". (PlexTheme) Makes `PLEX-INV-003` pass.
- [x] Mix subgraph titles 25% toward the foreground through a new `--plex-tone-title-mix` knob; update the README's table, knob note and edge cases. (PlexTheme) Makes `PLEX-INV-005` pass.

## Issues
