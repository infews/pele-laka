# PLEX Evals in Jasmine; One Runner

## Narrative
As a developer on pele-preview, I want the PLEX eval tests to read as Jasmine specs, so that the
tests and their output are easier to read.

## Acceptance Criteria
```gherkin
Feature: PLEX Evals in Jasmine; One Runner

  Scenario: The files run under Jasmine
    Given test/evals/plex.test.js
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
    Then none of test/evals/plex.test.js imports node:test or @playwright/test

  Scenario: One runner
    Then npm test runs Jasmine and nothing else
    And npm run evals runs npm test, then the eval-link check

  Scenario: Mutation testing on Jasmine
    When I run the scoped mutation command in CLAUDE.md
    Then Stryker uses its Jasmine runner, running only the tests that cover each mutant
```

## EARS Specifications
No eval text changes. The tests of all 24 PLEX evals are rewritten in Jasmine,
reviewed with the developer (2026-11-08). Stryker doesn't mutate CSS, so ten
hand-made breaks of `pele-plex.css` stand in for mutation testing: the old and
new tests fail on every one, the same number of times.

## Implementation Plan

## Issues
