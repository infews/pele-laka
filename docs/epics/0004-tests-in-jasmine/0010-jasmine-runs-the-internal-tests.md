# Jasmine Runs the Internal Tests

## Narrative
As a developer on pele-preview, I want the internal tests to read as Jasmine specs, so that the
tests and their output are easier to read.

## Acceptance Criteria
```gherkin
Feature: Jasmine Runs the Internal Tests

  Scenario: The files run under Jasmine
    Given test/*.test.js and test/*.property.test.js
    When I run npm test
    Then they run under Jasmine
    And the output lists them as named, nested specs

  Scenario: Nothing is lost
    When I run npm test
    Then as many tests run as before, and all pass
    And scripts/check-eval-links.sh reports 77 evals, all linked

  Scenario: The tests still catch breakage
    Given a sample of deliberately broken builds of the code these tests cover
    When I run the migrated tests against each
    Then each broken build fails at least one of them

  Scenario: No old runner
    Then none of test/*.test.js and test/*.property.test.js imports node:test or @playwright/test

  Scenario: The rest still runs
    Given the eval tests in test/evals/ are not yet migrated
    When I run npm test
    Then Jasmine runs, and node --test runs the eval tests after it
    And a spec slower than 5 seconds, such as a browser test, does not time out
```

## EARS Specifications

## Implementation Plan

## Issues
