# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Commits

- Do not add AI co-author credits or session links to commit messages —
  no `Co-Authored-By: Claude ...` trailer, no `Claude-Session:` trailer.
  Keep commit messages as if written by a human contributor.

## Project docs

- The design spec and implementation plan live under `docs/superpowers/`
  (gitignored — local reference only, not committed). Read them there for
  full context before making changes.

## Tracking changes

- After every bug fix or feature implementation, add a short entry to the
  Change Log section below (date, one line on what changed and why). Keep
  entries terse — this is a running log, not a changelog for end users.

## Change Log

<!-- newest entries at the top -->

- 2026-09-04: Wired `CompositionWatcher` into `apps/desktop/src/main.ts` so
  live composition/layer/BPM data reaches the Discord presence `state` field
  (Task 3 of resolume-rest-api plan).
- 2026-09-04: Added optional `state` field to `ActivityDetails` and exported
  `CompositionWatcher` from `@resolume-discord-rpc/core` (Task 2 of
  resolume-rest-api plan).
- 2026-09-04: Added `CompositionWatcher`, which polls Resolume's REST API for
  composition/layer/BPM data (Task 1 of resolume-rest-api plan).

