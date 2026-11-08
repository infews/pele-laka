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

  Scenario: Choosing a palette
    When I export with --palette paper
    Then the root <svg> carries data-pele-scheme="paper"

  Scenario: Measuring fonts
    When I export with --font Georgia --font-size 24
    Then pele lays out the labels with that family and size
    And the SVG falls back to that family when the CSS sets no --pele-font

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

## Implementation Plan

## Issues
