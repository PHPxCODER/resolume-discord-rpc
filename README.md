# Resolume Discord RPC

Shows "In Resolume Arena/Avenue/Wire" as your Discord Rich Presence
activity while one of them is running. Inspired by
[adobe-discord-rpc](https://github.com/teeteeteeteetee/adobe-discord-rpc).

> **Status:** early development — no builds published yet.

## Install

Once builds are published, download the latest release for your OS from
the [Releases page](../../releases) — don't clone this repo and run it
from source unless you're developing on it (see Development below).

- **Windows:** run the installer. Windows SmartScreen may warn that this
  is from an unrecognized publisher, because builds are unsigned. Click
  "More info" → "Run anyway".
- **macOS:** open the `.dmg` and drag the app to Applications. Gatekeeper
  will block the first launch since builds aren't notarized — right-click
  the app in Applications and choose "Open" instead of double-clicking,
  then confirm in the dialog that appears.

Once running, look for the tray icon (system tray on Windows, menu bar on
macOS). Right-click it (click on macOS) to enable "Start with system" or
to quit.

## Scope

- Detects **Resolume Arena, Avenue, and Wire**. Avenue/Wire detection is
  unverified against a real install — please open an issue if it doesn't
  pick up your process.
- Shows a static "In Resolume &lt;product&gt;" presence with elapsed time —
  no composition/clip/layer detail yet (Resolume's REST API could add this
  in a future version).
- Windows and macOS only.

## Project structure

A pnpm workspace with two packages:

- `packages/core` — framework-agnostic Resolume process detection and
  Discord presence logic (unit tested).
- `apps/desktop` — the Electron tray app.

## Development

```bash
pnpm install
pnpm generate-icons
pnpm start
```

Run tests with `pnpm test`. See
`docs/superpowers/specs/2026-09-03-resolume-discord-rpc-design.md` and
`docs/superpowers/plans/2026-09-03-resolume-discord-rpc-v1.md` for the full
design and implementation plan.

## License

ISC
