# pele-preview

This project follows the Specs of Theseus method: the evals in `docs/evals/` are
the spec, and work is planned in `docs/epics/`. Subsystems are marked in the code
with `@subsystem` comments.

## Tests

Eval tests live in `test/evals/<area>.test.js`, tagged `@spec <ID>`, and drive
the CLI rather than the modules behind it (the `PLEX` tests export with
`pele-plex.css` and read the result in Chromium). Every other test is internal:
a redesign may rewrite or delete it.

## Commands

Node 20 or newer. Run `npm install` and `npx playwright install chromium` once:
some eval tests in `npm test` drive Chromium too.

| Step | Command |
|---|---|
| Tests (unit, contract, CLI end-to-end) | `npm test` (`node --test`, picks up `test/**`) |
| Browser tests (preview page) | `npm run test:browser` (Playwright, tests in `e2e/`) |
| Property tests | `npm run test:property` (fast-check, files named `test/*.property.test.js`; also run by `npm test`) |
| Mutation tests, scoped | `npx stryker run --mutate src/compose.js` (comma-separate files; `npm run mutate` does everything in `src/` and `bin/`, slowly) |
| Mutation tests for CSS | None: Stryker mutates JavaScript only. `pele-plex.css` relies on the `PLEX` evals (PM decision, 2026-11-08). |
| Controls and checks | `npm run check` (ESLint, then `npm audit --omit=dev` on shipped dependencies) |
| Eval links | `scripts/check-eval-links.sh` |
| Full eval suite | `npm run evals` (all tests, browser tests, then eval links) |

`npm audit` without `--omit=dev` reports moderate advisories in dev tooling
(ESLint, Stryker); they don't ship.
