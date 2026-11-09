# Tests in Jasmine

## Vision
Every test reads as nested specs (`describe`, `it`, `expect(...).toBe(...)`),
and a run prints a named, nested list of them: one runner, one command.

## Context
Today the tests use `node:test` with `node:assert`, plus one Playwright smoke
test in `e2e/` on Playwright's own runner. The PM wants test source and test
output that read better (2026-11-08).

Stryker's Jasmine runner (`@stryker-mutator/jasmine-runner` 10.1.1) supports
Jasmine below 7, so the epic uses Jasmine 6.3.0. It runs only the tests that
cover each mutant. fast-check needs no adapter: `fc.assert` throws inside an
`it`. Playwright's browser library works under any runner; only its own test
runner goes.

Eval tests are the spec's tests, so each one is rewritten in Updating Evals with
the developer, not in Development, and each migrated eval test must still fail
against a deliberately broken build (PM decision, 2026-11-08).

## Scope
### In Scope
- Every `node:test` file and `e2e/page.spec.js`, moved to Jasmine 6.3.0.
- `jasmine-spec-reporter` for named, nested output.
- fast-check properties, kept as they are.
- Stryker's Jasmine runner, and the commands in `CLAUDE.md`.
### Out of Scope
- Changing what any eval says.
- Adding or removing tests.
- Changing `src/` or `pele-plex.css`.
- Running specs in parallel.

## Success Criteria
- `npm test` runs every test through Jasmine and prints named specs.
- No file imports `node:test` or `@playwright/test`.
- `scripts/check-eval-links.sh` still reports 77 evals, all linked.
- Scoped mutation testing runs on the Jasmine runner.

## Dependencies
None.

## Open Questions

## Resulting Stories
- ~~[Jasmine runs the internal tests](0004-tests-in-jasmine/0010-jasmine-runs-the-internal-tests.md)~~
- ~~[EXPORT and CLI evals in Jasmine](0004-tests-in-jasmine/0020-export-and-cli-evals-in-jasmine.md)~~
- [PREVIEW evals and the browser smoke test in Jasmine](0004-tests-in-jasmine/0030-preview-evals-and-the-browser-smoke-test-in-jasmine.md)
- [PLEX evals in Jasmine; one runner](0004-tests-in-jasmine/0040-plex-evals-in-jasmine-one-runner.md)
