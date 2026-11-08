# Command line

Area `CLI`: the argument rules export and preview share — usage, help, files,
the stylesheet argument, `--scheme`, and exit code 2. Options that belong to one
mode are pinned in that mode's area. Tests: `test/evals/cli.test.js`.

## Invariants
- `CLI-INV-001`: If the arguments are invalid, then the system shall exit 2 without writing any file or starting a server.
- `CLI-INV-002`: If the arguments are invalid, then the system shall print nothing to stdout.
- `CLI-INV-003`: The usage text the system prints shall be the one shown in the README.

## Contracts

## End-to-end
- `CLI-E2E-001`: When the user passes `-h` or `--help` and no unknown option, the system shall print the usage text to stdout and exit 0, whether or not a diagram is given.
- `CLI-E2E-002`: When the user gives no diagram, the system shall print the usage text to stderr and exit 2.
- `CLI-E2E-003`: If the diagram or stylesheet path isn't an existing file, then the system shall print `no such file: <path>` to stderr and exit 2.
- `CLI-E2E-004`: If the user passes an unknown option, then the system shall print an error naming it, then the usage text, to stderr and exit 2.
- `CLI-E2E-005`: If the user passes an option without its value, then the system shall print an error naming the option to stderr and exit 2.
- `CLI-E2E-006`: If the user passes more than a diagram and one stylesheet, counting `-c`, then the system shall print `unexpected argument: <arg>`, then the usage text, to stderr and exit 2.
- `CLI-E2E-007`: The system shall treat `DIAGRAM STYLE`, `DIAGRAM -c STYLE` and `DIAGRAM --css STYLE` the same.
- `CLI-E2E-008`: If `--scheme` is not `auto`, `light` or `dark`, then the system shall print `--scheme must be one of auto, light, dark, got: <value>` to stderr and exit 2.

## Monitors

<!-- Retired, never reuse: CLI-E2E-009, CLI-E2E-010, CLI-INV-004, CLI-INV-005 (checks that removed features stay removed, PM 2026-11-08) -->
