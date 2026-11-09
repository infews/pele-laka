# Preview

Area `PREVIEW`: `pele-preview DIAGRAM [STYLE]` without `-o`, which serves a
live-reloading page, plus the options only preview uses (`-p`, `-n`, `-B`).
Tests: `test/evals/preview.test.js`.

## Invariants
- `PREVIEW-INV-001`: The system shall accept connections only on the loopback interface.
- `PREVIEW-INV-002`: While previewing, the system shall never write or change any file.

## Contracts
- `PREVIEW-CON-001`: Unless `-n` is given, the system shall open the URL with `open URL` on macOS and `xdg-open URL` elsewhere.
- `PREVIEW-CON-002`: Where `-B APP` is given on macOS, the system shall open the URL with `open -a APP URL`.
- `PREVIEW-CON-003`: Where `-n` is given, the system shall open nothing.

## End-to-end
- `PREVIEW-E2E-001`: When the user runs `pele-preview DIAGRAM [STYLE]` without `-o`, the system shall serve the preview page and print `pele-preview: <URL>  (Ctrl-C to stop)` to stdout.
- `PREVIEW-E2E-002`: Where `-p PORT` is given, the system shall serve on PORT; where it is absent or 0, on a free port the OS picks.
- `PREVIEW-E2E-003`: If `-p` isn't a whole number from 0 to 65535, then the system shall print `--port must be …` to stderr and exit 2.
- `PREVIEW-E2E-004`: The page shall show the diagram exactly as `-o` with the same `--scheme` would write it.
- `PREVIEW-E2E-005`: While `--scheme` is `auto`, the diagram and the page shall follow the browser's light or dark setting, switching without a reload.
- `PREVIEW-E2E-006`: Where `--scheme` is `light` or `dark`, the page around the diagram shall use that scheme, whatever the browser's setting.
- `PREVIEW-E2E-007`: The page shall paint the diagram's area with the stylesheet's `--pele-bg`, or white if the stylesheet doesn't set it.
- `PREVIEW-E2E-008`: When the diagram or stylesheet is saved, the page shall show the new render without a reload.
- `PREVIEW-E2E-009`: When an editor saves by writing a new file and renaming it over the old one, the page shall still update.
- `PREVIEW-E2E-010`: When a render after a save succeeds, the system shall print `rendered (revision N)` to stdout.
- `PREVIEW-E2E-011`: If a render fails, then the page shall keep the last good diagram on screen, greyed out, with the error above it.
- `PREVIEW-E2E-012`: If a render fails, then the system shall print the error to stderr and keep serving, including when the first render at startup fails.
- `PREVIEW-E2E-013`: When the diagram renders again after a failure, the page shall drop the error and show the new diagram normally.
- `PREVIEW-E2E-014`: When the user presses Ctrl-C, the system shall stop and exit 0.
- `PREVIEW-E2E-015`: If the server can't start, then the system shall print `could not start server: <reason>` to stderr and exit 1.
- `PREVIEW-E2E-016`: When a file is saved once, by writing it or by renaming a new file over it, the system shall render once.
- `PREVIEW-E2E-017`: When the diagram is deleted and then created again, the page shall show the new render.

## Monitors
- `PREVIEW-MON-001`: When a file is saved, the system shall show the new render on the page within 1 second.

<!-- Retired, never reuse: PREVIEW-INV-003 (checks that removed features stay removed, PM 2026-11-08) -->
