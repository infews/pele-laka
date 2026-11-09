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
None: the story moves internal tests only, and its acceptance criteria are
about the test tooling, not pele-preview's behavior. "Still catches breakage"
is checked by mutation testing `src/` against the internal tests before and
after: the Jasmine run must kill every mutant the `node --test` run killed.

## Implementation Plan
- [x] Set up Jasmine and move `test/browser.test.js` (tooling). Add `jasmine` 6.3.0 and `jasmine-spec-reporter` 7.0.0, `jasmine.json` (spec files `test/*.test.js`, helpers in `test/helpers/`), and a helper that swaps in the spec reporter and raises the default timeout to 30 s. `npm test` becomes `jasmine --config=jasmine.json && node --test test/evals/`. ESLint gets Jasmine globals for `test/`. Move `browser.test.js` as the first file, to set the pattern: `describe` per subsystem, `it` per behavior, `expect` matchers.
- [x] Move `test/cli.test.js` and `test/cli.property.test.js`.
- [ ] Move `test/compose.test.js` and `test/compose.property.test.js`.
- [ ] Move `test/server.test.js` and `test/main.test.js`.
- [ ] Move `test/watcher.test.js`, then update `CLAUDE.md`'s commands (tests, property tests, scoped mutation). Rerun mutation testing on `src/` against the internal tests on Jasmine: it must kill every mutant the `node --test` baseline killed.

No `src/` changes, so no task has a mutation-testing step of its own; the before-and-after run in the last task stands in for it.

## Issues
