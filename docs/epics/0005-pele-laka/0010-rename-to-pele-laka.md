# Rename to pele-laka

## Narrative
As a user, I want to run `pele-laka`, so that the tool has its own name.

## Acceptance Criteria
```gherkin
Feature: The pele-laka command

  Scenario: The new command does what the old one did
    Given pele-laka is installed
    When I run pele-laka with the arguments I used for pele-preview
    Then it previews or exports exactly as before

  Scenario: The name shows everywhere the tool speaks
    When I preview a diagram
    Then stdout shows "pele-laka: <URL>  (Ctrl-C to stop)"
    And the usage text and the README name pele-laka

  Scenario: The old name is gone
    Given pele-laka is installed
    Then no pele-preview command is installed with it
```

## EARS Specifications
- `CLI-CON-001` (new): the package installs one command, `pele-laka`. Covers "the old name is gone" by stating what is installed.
- `CLI-E2E-011` (new): the usage text begins `usage: pele-laka `.
- `PREVIEW-E2E-018` (new): the preview page's title is `pele-laka`.
- `PREVIEW-E2E-001` (changed): runs `pele-laka` and prints `pele-laka: <URL>  (Ctrl-C to stop)`.
- `EXPORT-E2E-001` (changed): runs `pele-laka`.

Every eval test now runs `bin/pele-laka`, and `CLI-E2E-001/002/004/006` and `CLI-INV-003` look for `usage: pele-laka`; the eval text of those is unchanged.

## Implementation Plan
Smallest change: rename everywhere the tool names itself. Nothing to regrow: a
rename changes no structure, and story 0020 rewrites the Arguments subsystem
anyway.

- [x] Rename the command and package (Arguments: `src/cli.js`). `git mv bin/pele-preview bin/pele-laka`; `package.json` name and `bin` become `pele-laka` (and `package-lock.json` by `npm install`, then `npm link` again locally); `USAGE` starts `usage: pele-laka`; the README's usage block, title and prose say pele-laka; `CLAUDE.md`'s title; `eslint.config.js`'s bin path; the internal tests that name the bin or the usage (`test/cli.test.js`, `test/main.test.js`). Makes CLI-CON-001, CLI-E2E-011, EXPORT-E2E-001 and the CLI evals pass again.
- [ ] Rename what preview shows (Preview: `src/main.js`; `src/page.html`). The URL line prints `pele-laka: <URL>  (Ctrl-C to stop)`, the page title is `pele-laka`, and the comment at the top of `src/main.js` names pele-laka; `test/watcher.test.js`'s temp prefix too. Makes PREVIEW-E2E-001 and PREVIEW-E2E-018 pass, and the rest of the PREVIEW and PLEX evals again.

## Issues
