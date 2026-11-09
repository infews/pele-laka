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
- `PLEX-INV-007` (new): every series color has an OKLCH chroma of at least 0.08, light and dark.
- `PLEX-INV-008` (new): every pair of series colors is at least 0.1 apart (ΔE OK). Passes today; it guards the new colors.
- `PLEX-CON-001` (changed): `--pele-series-6` dark `#fff1f1` → `#ffb3b8` (Carbon red 30); `--pele-series-3` light `#005d5d` → `#009d9a` (Carbon teal 50), whose chroma of 0.074 also fails PLEX-INV-007.

## Implementation Plan
- [x] Swap in the new tone colors (PlexTheme; README). Set `--pele-series-3` light to `#009d9a` and `--pele-series-6` dark to `#ffb3b8`. Tone 3's solid text becomes `light-dark(var(--pele-fg-on-light), var(--pele-fg-on-dark))`, since white on the lighter teal is only 3.3:1. Tone 6's text already flips to near-black in dark. Drop the README's "Tone 6 is weak in dark mode" edge case. No mutation testing: CSS (PM decision).

## Issues
