# pele-laka

This project follows the Specs of Theseus method: the evals in `docs/evals/` are
the spec, and work is planned in `docs/epics/`. Subsystems are marked in the code
with `@subsystem` comments.

In an epic's **Resulting Stories**, each story is a checkbox: `- [ ]` until the
PM accepts it, then `- [x]`, like the tasks in a story. Don't strike stories
through (PM decision, 2026-11-08).

## Tests

Eval tests live in `test/evals/<area>.test.js`, tagged `@spec <ID>`, and drive
the CLI rather than the modules behind it (the `PLEX` tests export with
`pele-plex.css` and read the result in Chromium). Every other test is internal:
a redesign may rewrite or delete it.

Don't write evals or tests that check a removed feature stays removed (an
option rejected, the README not mentioning it). Once a removal is accepted,
nothing needs to guard it (PM decision, 2026-11-08).

## Commands

Node 20 or newer. Run `npm install` and `npx playwright install chromium` once:
some eval tests in `npm test` drive Chromium too.

| Step | Command |
|---|---|
| Tests (unit, contract, CLI end-to-end) | `npm test`: Jasmine runs every spec, internal and eval (config in `jasmine.json`; one file: `npx jasmine --config=jasmine.json test/cli.test.js`; by name: `--filter=PLEX-INV`). Browser specs drive Chromium with the `playwright` library. |
| Property tests | `npm run test:property` (fast-check, files named `test/*.property.test.js`; also run by `npm test`). Jasmine expectations stop the spec on failure, so fast-check sees the failure and shrinks it. |
| Mutation tests, scoped | `npx stryker run --mutate src/cli.js --commandRunner.command "npx jasmine --config=jasmine.json test/cli.test.js test/evals/cli.test.js"` — comma-separate files, and name only the tests that cover them, or every mutant runs the whole suite. `npm run mutate` does everything in `src/`, slowly. Stryker runs Jasmine as a command, not through its Jasmine runner, which can't see code in the CLI processes the eval specs start (PM decision, 2026-11-08). |
| Mutation scope | Survivors must be killed or recorded as equivalent only on the lines a task changed. Survivors in untouched code go to a story instead (PM decision, 2026-11-08). |
| Mutation tests for CSS | None: Stryker mutates JavaScript only. `pele-plex.css` relies on the `PLEX` evals (PM decision, 2026-11-08). |
| Controls and checks | `npm run check` (ESLint, then `npm audit --omit=dev` on shipped dependencies) |
| Eval links | `scripts/check-eval-links.sh` |
| Full eval suite | `npm run evals` (all tests, then eval links) |

`npm audit` without `--omit=dev` reports moderate advisories in dev tooling
(ESLint, Stryker); they don't ship.
