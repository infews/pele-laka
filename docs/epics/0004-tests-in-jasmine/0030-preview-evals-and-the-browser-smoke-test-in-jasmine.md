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
No eval text changes. The tests of all 23 PREVIEW evals are rewritten in
Jasmine, reviewed with the developer (2026-11-08). The browser smoke test moves
from `e2e/page.spec.js` to `test/page.test.js`, as an internal test.

Mutation testing `server.js`, `watcher.js`, `browser.js` and `main.js` at 4
workers showed six mutants killed before and not after. Rerun one at a time on a
quiet machine, the old tests let five of them survive too (timing specs failing
under load), and the new specs catch the sixth (`server.js:58`). The new specs
catch 12 of those 21 mutants to the old tests' 7.

## Implementation Plan
- [x] Run `test/evals/preview.test.js` and the smoke test on Jasmine (tooling). Remove `playwright.config.js`, `npm run test:browser`, `@playwright/test` and Playwright's output folders from `.gitignore`. Merge ESLint's test globals into one block, and update `CLAUDE.md`. `test/evals/plex.test.js` imports `chromium` from `playwright` too, so it still loads; its move is story 0040.

## Issues
