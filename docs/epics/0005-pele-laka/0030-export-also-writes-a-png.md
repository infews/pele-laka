# Export Also Writes a PNG

## Narrative
As a user putting diagrams in slides and documents, I want export to write a
PNG beside the SVG, so that I have both formats without a second step.

## Acceptance Criteria
```gherkin
Feature: PNG export

  Scenario: SVG, then PNG
    Given Google Chrome is installed
    When I run "pele-laka export -c theme.css docs/a.mmd"
    Then docs/a.svg is written first, then docs/a.png
    And stdout shows "wrote <path>" for each, SVG first
    And the command exits 0

  Scenario: What the PNG looks like
    Then a.png is the SVG drawn by Chrome at twice its width and height
    And pixels outside the diagram's shapes are transparent

  Scenario: The PNG follows --scheme
    When I export with "--scheme dark"
    Then a.png is drawn dark
    When I export with "--scheme light", "--scheme auto" or no --scheme
    Then a.png is drawn light

  Scenario: -o puts the PNG with the SVG
    When I export with "-o out"
    Then out/a.svg and out/a.png are written

  Scenario: No Chrome
    Given Google Chrome isn't installed
    When I export
    Then a.svg is written
    And stderr shows "skipped <path to a.png>: PNG export needs Google Chrome"
    And no a.png is written
    And the command exits 0

  Scenario: Chrome fails while drawing
    Given Chrome is installed but drawing the PNG fails
    Then a.svg is kept
    And stderr shows the error
    And the command exits 1

  Scenario: The diagram doesn't render
    When the diagram has a syntax error
    Then neither a.svg nor a.png is written or changed
```

## EARS Specifications

## Implementation Plan

## Issues
