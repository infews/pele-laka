# Characterize Export

## Narrative
As someone documenting a system, I want `pele-preview -o` to keep producing the
same self-contained SVG, so that diagrams I ship look the same wherever they open.

## Acceptance Criteria
```gherkin
Feature: Export a diagram as a self-contained SVG

  Scenario: Export with a stylesheet
    Given a valid diagram and a stylesheet
    When I run pele-preview DIAGRAM STYLE -o out.svg
    Then out.svg holds the diagram rendered by pele
    And the stylesheet is the first child of the root <svg>, in a <style> element
    And it prints "wrote <path>" and exits 0
    And the stylesheet on disk is unchanged

  Scenario: Export without a stylesheet
    When I run pele-preview DIAGRAM -o out.svg
    Then out.svg is exactly what pele renders, with no <style> element

  Scenario: Stylesheet with XML-special characters
    Given a stylesheet containing "&", "<", ">" or "]]>"
    When I export
    Then out.svg is well-formed XML and the CSS text is preserved

  Scenario Outline: Pinning the color scheme
    Given a stylesheet with prefers-color-scheme light and dark rules
    When I export with --scheme <scheme>
    Then <result>

    Examples:
      | scheme | result                                                                  |
      | auto   | the rules are embedded unchanged and follow the viewer                   |
      | dark   | dark rules always apply, light rules never do, no such query remains     |
      | light  | light rules always apply, dark rules never do, no such query remains     |

  Scenario: A broken diagram
    Given a diagram with a syntax error on line 2, column 9
    When I export
    Then it prints "DIAGRAM:2:9: <pele's message>" to stderr and exits 1
    And no output file is written

  Scenario: An output path that can't be written
    When I export to a directory that doesn't exist
    Then it prints the error to stderr and exits 1
```

## EARS Specifications
- `EXPORT-CON-001`, `EXPORT-CON-002`, `EXPORT-CON-003`
- `EXPORT-E2E-001` … `EXPORT-E2E-010`
- `EXPORT-INV-001` … `EXPORT-INV-005`

Not pinned, by the PM's decision: `--palette`, `--font` and `--font-size`. They
are being removed (epic 0002), so the stylesheet alone decides the colors and
the font.

## Implementation Plan

## Issues

- [x] **Updating Evals** — A stylesheet containing a control character XML forbids (e.g. `0x01`) exports an SVG that isn't well-formed XML, so "well-formed whatever the stylesheet contains" is false today. Scope the invariant to characters XML allows, or reject / strip such characters (a fix story)? I'd scope it: real CSS doesn't contain them.
  - Answer: Scope `EXPORT-INV-002` to characters XML allows; no fix story (2026-11-08).
