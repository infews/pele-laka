# Export

Area `EXPORT`: `pele-laka export [-c STYLE] [-o DIR] DIAGRAM`, which writes one
self-contained SVG and exits. NAME is the diagram's file name without its
extension. Tests: `test/evals/export.test.js`.

## Invariants
- `EXPORT-INV-001`: The system shall never change the diagram or stylesheet files it reads.
- `EXPORT-INV-002`: The system shall always write well-formed XML, whatever the stylesheet contains, as long as it uses only characters XML allows.
- `EXPORT-INV-003`: The system shall embed the stylesheet so that the text of its `<style>` element, read back as XML, is the stylesheet's text apart from surrounding whitespace, including any `]]>` in it.
- `EXPORT-INV-004`: Where `--scheme` is `light` or `dark`, the system shall leave no `prefers-color-scheme` condition in the embedded CSS.
- `EXPORT-INV-005`: Where `--scheme` is `light` or `dark`, the system shall change no CSS text other than the `prefers-color-scheme` conditions.
- `EXPORT-INV-006`: The system shall leave pele's SVG unchanged apart from inserting the stylesheet's `<style>` element.

## Contracts
- `EXPORT-CON-001`: The system shall write the stylesheet as the first child of the root `<svg>` element, in a `<style>` element holding a CDATA section.
- `EXPORT-CON-002`: When pele renders a valid diagram, the system shall receive an SVG string that begins with its root `<svg>` element and contains no `<style>` element.
- `EXPORT-CON-003`: When pele rejects a diagram with a syntax error, the system shall receive a `PeleError` carrying the error's line and column.

## End-to-end
- `EXPORT-E2E-001`: When the user runs `pele-laka export -c STYLE DIAGRAM`, the system shall write `NAME.svg` next to DIAGRAM, holding pele's rendering of DIAGRAM with STYLE embedded.
- `EXPORT-E2E-002`: When an export succeeds, the system shall print `wrote <path>` for the SVG to stdout and exit 0.
- `EXPORT-E2E-003`: When the user exports with no stylesheet, the system shall write exactly the SVG pele renders.
- `EXPORT-E2E-004`: Where `--scheme dark` is given, the system shall write CSS in which every `prefers-color-scheme: dark` condition always holds and every `prefers-color-scheme: light` condition never does.
- `EXPORT-E2E-005`: Where `--scheme light` is given, the system shall write CSS in which every `prefers-color-scheme: light` condition always holds and every `prefers-color-scheme: dark` condition never does.
- `EXPORT-E2E-006`: Where `--scheme` is `auto` or absent, the system shall embed the stylesheet's text unchanged.
- `EXPORT-E2E-007`: If the diagram has a syntax error, then the system shall print `DIAGRAM:LINE:COLUMN: MESSAGE` to stderr and exit 1.
- `EXPORT-E2E-008`: If pele rejects the diagram without a position, then the system shall print `DIAGRAM: MESSAGE` to stderr and exit 1.
- `EXPORT-E2E-009`: If the render fails, then the system shall not create or change the SVG.
- `EXPORT-E2E-010`: If the SVG can't be written, then the system shall print the error to stderr and exit 1.
- `EXPORT-E2E-012`: Where `-o DIR` is given, the system shall write `NAME.svg` in DIR instead.
- `EXPORT-E2E-013`: If DIR isn't an existing directory, then the system shall print `no such directory: <DIR>` to stderr and exit 2.
- `EXPORT-E2E-014`: When `NAME.svg` already exists, the system shall replace it.
- `EXPORT-E2E-015`: If the SVG's path is the diagram's or the stylesheet's, then the system shall print `would overwrite <path>` to stderr and exit 2.

## Monitors

<!-- Retired, never reuse: EXPORT-E2E-011 (fonts are the stylesheet's business; embedding is covered by EXPORT-E2E-001, PM 2026-11-08) -->
