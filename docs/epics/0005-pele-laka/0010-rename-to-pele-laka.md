# Rename to pele-laka

## Narrative
As a user, I want to run `pele-laka`, so that the tool has its own name.

## Acceptance Criteria
```gherkin
Feature: The pele-laka command

  Scenario: The new command does what the old one did
    Given pele-laka is installed
    When I run pele-laka with the arguments I used for pele-preview
    Then it previews or exports exactly as before

  Scenario: The name shows everywhere the tool speaks
    When I preview a diagram
    Then stdout shows "pele-laka: <URL>  (Ctrl-C to stop)"
    And the usage text and the README name pele-laka

  Scenario: The old name is gone
    Given pele-laka is installed
    Then no pele-preview command is installed with it
```

## EARS Specifications
- `CLI-CON-001` (new): the package installs one command, `pele-laka`. Covers "the old name is gone" by stating what is installed.
- `CLI-E2E-011` (new): the usage text begins `usage: pele-laka `.
- `PREVIEW-E2E-018` (new): the preview page's title is `pele-laka`.
- `PREVIEW-E2E-001` (changed): runs `pele-laka` and prints `pele-laka: <URL>  (Ctrl-C to stop)`.
- `EXPORT-E2E-001` (changed): runs `pele-laka`.

Every eval test now runs `bin/pele-laka`, and `CLI-E2E-001/002/004/006` and `CLI-INV-003` look for `usage: pele-laka`; the eval text of those is unchanged.

## Implementation Plan

## Issues
