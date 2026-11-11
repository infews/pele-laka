# Preview and Export Subcommands

## Narrative
As a user with one theme and many diagrams, I want
`pele-laka preview -c theme.css a.mmd` and `pele-laka export -c theme.css a.mmd`,
so that the theme reads as a setting and the diagram as the thing I'm working on.

## Acceptance Criteria
```gherkin
Feature: preview and export subcommands

  Scenario: Preview
    When I run "pele-laka preview -c theme.css docs/a.mmd"
    Then the preview serves as it does today

  Scenario: Export next to the diagram
    When I run "pele-laka export -c theme.css docs/a.mmd"
    Then docs/a.svg holds the diagram with theme.css embedded, replacing any old one
    And stdout shows "wrote <path to docs/a.svg>"
    And the command exits 0

  Scenario: Export to a directory
    Given a directory out/
    When I run "pele-laka export -c theme.css docs/a.mmd -o out"
    Then out/a.svg is written and docs/a.svg is not

  Scenario: The -o directory doesn't exist
    When I run "pele-laka export docs/a.mmd -o missing"
    Then stderr shows "no such directory: missing"
    And the command exits 2 and writes nothing

  Scenario: No subcommand
    When I run "pele-laka docs/a.mmd"
    Then stderr shows the usage text
    And the command exits 2

  Scenario: Unknown subcommand
    When I run "pele-laka render docs/a.mmd"
    Then stderr shows "unknown command: render", then the usage text
    And the command exits 2

  Scenario: A stylesheet as a second argument
    When I run "pele-laka export docs/a.mmd theme.css"
    Then stderr shows "unexpected argument: theme.css", then the usage text
    And the command exits 2

  Scenario: An option from the other subcommand
    When I run "pele-laka export -p 8080 docs/a.mmd"
    Then stderr names the unknown option, then shows the usage text
    And the command exits 2

  Scenario: --scheme works with both
    When I run "pele-laka export --scheme dark docs/a.mmd"
    Then the SVG is pinned dark, as -o with --scheme dark wrote it before
```

Render errors, missing files and unwritable output behave as they do today.

## EARS Specifications
- `CLI-E2E-002` (changed): no arguments, or a command with no diagram, prints usage to stderr, exit 2.
- `CLI-E2E-004` (changed): an option the command doesn't take is named, then usage, exit 2.
- `CLI-E2E-006` (changed): more than one diagram is `unexpected argument`.
- `CLI-E2E-007` (changed): `-c` and `--css` are the same.
- `CLI-E2E-012` (new): a first argument other than `preview`, `export`, `-h`, `--help` is `unknown command: <arg>`, then usage, exit 2.
- `EXPORT-E2E-001` (changed): `export -c STYLE DIAGRAM` writes `NAME.svg` next to DIAGRAM.
- `EXPORT-E2E-002`, `-009`, `-010` (changed): `wrote <path>`, render failures and write errors are about the SVG.
- `EXPORT-E2E-012` (new): `-o DIR` writes `NAME.svg` in DIR.
- `EXPORT-E2E-013` (new): a `-o` that isn't an existing directory is `no such directory: <DIR>`, exit 2.
- `EXPORT-E2E-014` (new): an existing `NAME.svg` is replaced.
- `EXPORT-E2E-015` (new): an SVG path that is the diagram's or stylesheet's is `would overwrite <path>`, exit 2.
- `PREVIEW-E2E-001`, `PREVIEW-E2E-004` (changed): `preview [-c STYLE] DIAGRAM`; the page matches what `export` writes.

Every other eval test that runs the CLI now uses the subcommands, `-c` and `-o DIR`; their eval text is unchanged. `CLI-INV-001`/`-002`'s generator adds unknown commands, the other command's options and a missing `-o` directory.

## Implementation Plan

## Issues
