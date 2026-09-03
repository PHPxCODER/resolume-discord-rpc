# Resolume Discord RPC

Shows "In Resolume Arena" as your Discord Rich Presence activity while
Resolume Arena is running. Inspired by
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

- Detects **Resolume Arena** only (not Avenue or Wire).
- Shows a static "In Resolume Arena" presence with elapsed time — no
  composition/clip/layer detail yet (Resolume's REST API could add this
  in a future version).
- Windows and macOS only.

## Development

```bash
npm install
npm run generate-icons
npm start
```

Run tests with `npm test`.

## License

ISC
