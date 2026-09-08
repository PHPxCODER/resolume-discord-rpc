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

- 2026-09-08: Fixed the real release-build killer: unconfigured GitHub
  secrets arrive as empty strings and electron-builder treats empty
  CSC_LINK as a cert path (→ "not a file"); the workflow now unsets empty
  signing vars. Reproduced and verified locally with CSC_LINK="".
- 2026-09-08: Fixed the v1.0.0 release build failing on both platforms —
  pnpm's script-arg forwarding inserts a stray `--` that made
  electron-builder read the config flags as a file path; the workflow now
  calls electron-builder directly via `pnpm exec` (verified locally with
  the exact invocation).
- 2026-09-08: Release builds now derive their version from the pushed git
  tag (`v1.2.3` → `--config.extraMetadata.version=1.2.3`), so releases
  need no version-bump commit; package.json versions stay at 0.0.0.
  Verified locally that the CLI override preserves `extraMetadata.main`.
  Released v1.0.0 this way (first tagged release).
- 2026-09-08: Release workflow now uploads updater metadata
  (latest*.yml, blockmaps, mac zip) and passes signing/notarization
  secrets through — dormant until certificates exist; added `packaging/`
  Homebrew cask + winget manifest templates with an activation checklist
  (distribution plan, Task 3).
- 2026-09-08: Packaged builds now ship a single esbuild bundle
  (`bundle/main.js`, 2MB asar) instead of `out/` + all of node_modules;
  `asar` enabled, `extraMetadata.main` switches entrypoints so dev flow is
  untouched; `assetPath` now resolves via `app.getAppPath()` so it works
  from both entrypoints (distribution plan, Task 2).
- 2026-09-08: Added auto-updates via electron-updater (GitHub Releases
  feed, checks 30s after start then every 6h, tray "Restart to update"
  item). macOS won't apply updates until builds are signed — logged, never
  fatal (distribution plan, Task 1).
- 2026-09-08: Bumped both workflows to Node 22 — pnpm 11 needs Node >=
  22.13, so setup-node's `cache: pnpm` step died under Node 20.
- 2026-09-08: Fixed CI failing at setup — `pnpm/action-setup@v4` requires a
  pnpm version; pinned `"packageManager": "pnpm@11.18.0"` in root
  package.json (also repairs the never-yet-run release workflow, which had
  the same latent bug).
- 2026-09-08: Added `.github/workflows/ci.yml` (lint → typecheck → test on
  pushes/PRs) and a `pnpm test` gate in `release.yml`, which previously
  built releases without running tests (presence-and-robustness plan,
  Task 11).
- 2026-09-08: Tray menu gained an "About … (vX.Y.Z)" item opening the
  GitHub repo, so users can report which build they run
  (presence-and-robustness plan, Task 10).
- 2026-09-08: macOS now uses "Template" tray icons (black + alpha, idle at
  40% opacity, with @2x retina variants) so the mark adapts to light/dark
  menu bars; Windows keeps the colored set (presence-and-robustness plan,
  Task 9).
- 2026-09-08: Added `apps/desktop/src/logger.ts` (userData/logs/app.log,
  512KB rotation, never throws) plus an "Open logs" tray item; lifecycle
  and availability *transitions* are logged, never per-poll spam
  (presence-and-robustness plan, Task 8).
- 2026-09-08: Added `app.requestSingleInstanceLock()` so a second launched
  copy quits instead of adding a duplicate tray icon and fighting over the
  Discord RPC socket (presence-and-robustness plan, Task 7).
- 2026-09-08: `main.ts` now shows Wire's patch name ("Editing: …"), the
  playing clip in the state line ("▶ clip"), presence buttons, and a
  "Show live details in Discord" tray toggle governing both watchers;
  watcher ports come from settings (presence-and-robustness plan, Task 6).
- 2026-09-08: Extracted `apps/desktop/src/settings.ts` (config.json:
  `autoStart`, `showLiveDetails`, `restPort`, `wireRestPort` with
  validation + defaults); `autostart.ts` now delegates persistence to it
  (presence-and-robustness plan, Task 5).
- 2026-09-08: `ActivityDetails` gained optional `buttons` (passed through to
  Discord `setActivity`) and each `ResolumeProduct` a `websiteUrl` for the
  presence buttons (presence-and-robustness plan, Task 4).
- 2026-09-08: `CompositionWatcher` now also listens on Resolume's WebSocket
  (`ws://localhost:<port>/api/v1`) purely as a change signal — any message
  schedules one debounced (2s) REST re-poll, so presence updates land in
  seconds instead of up to 15s; interval polling stays as the fallback and
  reconnect cadence (presence-and-robustness plan, Task 3).
- 2026-09-08: Added `PatchWatcher`, polling Wire's `/api/v2/patch` (port
  8081) for the current patch `display_name`; empty name (unsaved patch)
  is a healthy `patchName: null` (presence-and-robustness plan, Task 2).
- 2026-09-08: `CompositionWatcher` now also reports the topmost playing clip
  name (`clipName`, `connected.index >= 3`), parsed tolerantly so payloads
  without clip data keep working (presence-and-robustness plan, Task 1).
- 2026-09-04: Wired `CompositionWatcher` into `apps/desktop/src/main.ts` so
  live composition/layer/BPM data reaches the Discord presence `state` field
  (Task 3 of resolume-rest-api plan).
- 2026-09-04: Added optional `state` field to `ActivityDetails` and exported
  `CompositionWatcher` from `@resolume-discord-rpc/core` (Task 2 of
  resolume-rest-api plan).
- 2026-09-04: Added `CompositionWatcher`, which polls Resolume's REST API for
  composition/layer/BPM data (Task 1 of resolume-rest-api plan).

