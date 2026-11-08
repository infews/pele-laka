# pele-preview

This project follows the Specs of Theseus method: the evals in `docs/evals/` are
the spec, and work is planned in `docs/epics/`. Subsystems are marked in the code
with `@subsystem` comments.

## Adoption in progress

Not every product area has evals yet (see
`docs/epics/0001-adopt-specs-of-theseus.md`; the Plex theme is adopted in the
first story of `docs/epics/0002-one-scheme-for-the-plex-theme.md`). Until all of them do, **the existing
tests stand in for the missing evals**: they must keep passing, and no redesign
may delete them.

## Commands

Node 20 or newer. Run `npm install` once; browser tests also need
`npx playwright install chromium`.

| Step | Command |
|---|---|
| Tests (unit, contract, CLI end-to-end) | `npm test` (`node --test`, picks up `test/**`) |
| Browser tests (preview page) | `npm run test:browser` (Playwright, tests in `e2e/`) |
| Property tests | `npm run test:property` (fast-check, files named `test/*.property.test.js`; also run by `npm test`) |
| Mutation tests, scoped | `npx stryker run --mutate src/compose.js` (comma-separate files; `npm run mutate` does everything in `src/` and `bin/`, slowly) |
| Controls and checks | `npm run check` (ESLint, then `npm audit --omit=dev` on shipped dependencies) |
| Eval links | `scripts/check-eval-links.sh` |
| Full eval suite | `npm run evals` (all tests, browser tests, then eval links) |

`npm audit` without `--omit=dev` reports moderate advisories in dev tooling
(ESLint, Stryker); they don't ship.
