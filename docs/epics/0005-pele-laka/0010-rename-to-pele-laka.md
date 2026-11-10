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

## Implementation Plan

## Issues
