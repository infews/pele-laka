# Harden pele-preview

## Vision
Close the gaps that mutation testing finds in code the feature stories don't
touch, so that every subsystem is as well guarded as the ones being changed.

## Context
Mutation testing is scoped to the lines a task changes (2026-11-08). Survivors
found in untouched code land here as stories.

## Scope
### In Scope
- Tests and small fixes for gaps mutation testing finds.
### Out of Scope
- New features.

## Success Criteria
Each subsystem in this epic has no surviving mutants that aren't recorded as
equivalent.

## Dependencies
None.

## Open Questions

## Resulting Stories
- [x] [Harden the file watcher](0003-harden-pele-preview/0010-harden-the-file-watcher.md)
