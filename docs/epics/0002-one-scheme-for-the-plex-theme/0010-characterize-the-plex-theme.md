# Characterize the Plex Theme

## Narrative
As someone using `pele-plex.css`, I want what I already rely on to keep working
when the extra palettes go, so that diagrams I've colored don't change under me.

This is an adoption story: it pins today's behavior of the carbon scheme only,
since the other palettes are removed in the next story.

## Acceptance Criteria
```gherkin
Feature: The IBM Plex theme (carbon)

  Scenario: Carbon by default
    Given a diagram exported with pele-plex.css and no --palette
    Then it uses the carbon colors

  Scenario: Light and dark
    When I export with pele-plex.css and --scheme light or dark
    Then the diagram uses that side of carbon whatever the viewer's setting

  Scenario: Forcing the mode from the page
    Given the exported SVG inside a container with data-pele-mode="light" or "dark"
    Then the diagram uses that side of carbon whatever the viewer's setting

  Scenario: Tone on a node
    Given a node with class tone-N (N from 1 to 8)
    Then it is filled with an 18% tint of series color N over the surface color
    And outlined in full color N, with normal text

  Scenario: Solid tone on a node
    Given a node with classes tone-N and solid
    Then it is filled and outlined in full color N, with text in the background color

  Scenario: Solid without a tone
    Given a node with class solid only
    Then it is filled and outlined in the accent color

  Scenario: Tone on a subgraph
    Given a subgraph with class tone-N
    Then it is filled with an opaque 9% tint of color N over the background
    And outlined and titled in full color N

  Scenario: Edge labels on graph diagrams
    Given a flowchart edge with a label
    Then the label is in capitals, at 72% of the size pele laid it out at, tracked out by 0.06em
    And its box is a pill grown around its center to fit the capitals

  Scenario: Wrapped edge labels
    Given an edge label pele wraps onto two or more lines
    Then its box grows a little more on every side and reads as a rounded rectangle

  Scenario: Sequence messages
    Given a sequence diagram
    Then its message labels keep pele's own case, size and spacing

  Scenario: Adjustable edge labels
    When the stylesheet sets any --plex-edge-label-* knob (scale, tracking, weight, padding, radius, stroke width)
    Then the edge labels follow it

  Scenario: Adjustable tints
    When the stylesheet sets --plex-tone-node-mix or --plex-tone-cluster-mix
    Then node or subgraph tints use that strength
```

## EARS Specifications

## Implementation Plan

## Issues

- [x] **Adoption survey** — The README tells users to use `pele-plex.css`, but `package.json` `files` lists only `bin` and `src`, so it isn't in the npm package. Is the theme part of the product, or an example that lives only in the repo? I'd ship it: add it to `files` and keep this story.
  - Answer: Ship it — it's an example theme for anyone to use; added to `files` (2026-11-08). Epic 0002 cuts it down to a single color scheme.
