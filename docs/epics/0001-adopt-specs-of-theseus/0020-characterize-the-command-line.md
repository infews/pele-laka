# Characterize the Command Line

## Narrative
As a user or a script calling pele-preview, I want its arguments, messages and
exit codes to stay stable, so that my commands and scripts keep working.

## Acceptance Criteria
```gherkin
Feature: Command-line arguments shared by export and preview

  Scenario: Help
    When I run pele-preview -h or --help, with or without a diagram
    Then it prints the usage text to stdout and exits 0

  Scenario: No diagram
    When I run pele-preview with no arguments
    Then it prints the usage text to stderr and exits 2

  Scenario: A file that doesn't exist
    When I name a diagram or stylesheet that isn't a readable file
    Then it prints "no such file: <path>" and exits 2

  Scenario: An unknown flag or an extra argument
    When I pass an unknown flag, or a stylesheet both as -c and positionally
    Then it prints the problem and the usage text and exits 2

  Scenario: The stylesheet three ways
    Then "DIAGRAM STYLE", "DIAGRAM -c STYLE" and "DIAGRAM --css STYLE" mean the same

  Scenario Outline: Values that are checked
    When I pass <flag> <value>
    Then it prints "<flag> must be ..." and exits 2

    Examples:
      | flag        | value |
      | --scheme    | blue  |
      | --palette   | a"b   |
      | --font-size | 0     |
      | --font-size | abc   |

  Scenario: A palette the stylesheet doesn't define
    Given a stylesheet that defines palettes carbon, paper and moss
    When I pass --palette harbor
    Then it warns 'palette "harbor" is not defined in STYLE (it defines: carbon, paper, moss)' on stderr
    And it carries on as normal
```

## EARS Specifications

## Implementation Plan

## Issues

- [x] **Adoption survey** — The README says exit code 1 means "render or I/O failure (export mode)", but preview also exits 1 when its server can't start (e.g. the port is taken). Which is intended? I'd keep the behavior and change the README to "1 render or I/O failure, or the preview server could not start".
  - Answer: Keep the behavior; README updated (2026-11-08).
