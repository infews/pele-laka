# PREVIEW Evals and the Browser Smoke Test in Jasmine

## Narrative
As a developer on pele-preview, I want the PREVIEW eval tests and the browser smoke test to read as Jasmine specs, so that the
tests and their output are easier to read.

## Acceptance Criteria
```gherkin
Feature: PREVIEW Evals and the Browser Smoke Test in Jasmine

  Scenario: The files run under Jasmine
    Given test/evals/preview.test.js and the browser smoke test
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
    Then none of test/evals/preview.test.js and the browser smoke test imports node:test or @playwright/test

  Scenario: One browser toolkit
    Then playwright.config.js and npm run test:browser are gone
    And the only Playwright package is the playwright library
```

## EARS Specifications

## Implementation Plan

## Issues
