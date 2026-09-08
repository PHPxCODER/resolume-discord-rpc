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
macOS). Right-click it (click on macOS) for "Start with system", the
"Show live details in Discord" privacy toggle, logs, and quit.

## Scope

- Detects **Resolume Arena, Avenue, and Wire** and shows an
  "In Resolume &lt;product&gt;" presence with elapsed time.
- With Resolume's Webserver enabled (Preferences → Webserver), the
  presence also shows **live details**:
  - Arena/Avenue: composition name, selected layer, the topmost playing
    clip, and BPM — updated within seconds via Resolume's WebSocket, with
    polling as fallback.
  - Wire: "Editing: &lt;patch name&gt;" (once the patch has been saved).
  - Turn this off any time with the "Show live details in Discord" tray
    toggle if you'd rather not broadcast composition/patch names.
- The presence carries "What is Resolume?" / "View on GitHub" buttons.
  Discord only shows activity buttons to *other* users — you won't see
  them on your own profile.
- Windows and macOS only.

## Configuration

Everything works with zero configuration. A `config.json` in the app's
user-data directory (`%APPDATA%/Resolume Discord RPC/` on Windows,
`~/Library/Application Support/Resolume Discord RPC/` on macOS) stores:

- `autoStart` — mirror of the "Start with system" tray toggle.
- `showLiveDetails` — mirror of the "Show live details in Discord" toggle.
- `restPort` (default `8080`) / `wireRestPort` (default `8081`) — only
  needed if you changed Resolume's own webserver port. Edit the file and
  restart the app.

## Troubleshooting

Use the tray's "Open logs" item — the app logs detection, Discord
reconnects, and live-details availability transitions to
`logs/app.log` in the user-data directory.

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
