# EXPORT and CLI Evals in Jasmine

## Narrative
As a developer on pele-preview, I want the EXPORT and CLI eval tests to read as Jasmine specs, so that the
tests and their output are easier to read.

## Acceptance Criteria
```gherkin
Feature: EXPORT and CLI Evals in Jasmine

  Scenario: The files run under Jasmine
    Given test/evals/export.test.js and test/evals/cli.test.js
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
    Then none of test/evals/export.test.js and test/evals/cli.test.js imports node:test or @playwright/test
```

## EARS Specifications
No eval text changes. The tests of all 19 EXPORT and 11 CLI evals are rewritten
in Jasmine, reviewed with the developer (2026-11-08). Mutation testing `src/`
against these two files kills all 75 mutants the `node --test` versions
killed, and 140 in all. The baseline's 232 timeouts were CPU load: under light
load the old tests let the same mutants survive.

## Implementation Plan
- [x] Run `test/evals/export.test.js` and `test/evals/cli.test.js` on Jasmine (tooling): add them to `jasmine.json`, take them out of `npm test`'s `node --test` list, add `playwright` as a direct dev dependency for `chromium`, and update `CLAUDE.md`.

## Issues
