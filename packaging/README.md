# Distribution packaging

Templates and the activation checklist for signed, package-manager-installable
releases. Everything here is **dormant scaffolding** — nothing activates until
the steps below are done, and nothing in CI publishes without a version tag
being pushed deliberately.

## Code signing & notarization (paid, one-time setup)

1. **macOS**: join the Apple Developer Program (USD 99/yr), create a
   "Developer ID Application" certificate, export it as a `.p12`.
2. **Windows**: buy a code-signing certificate (OV or EV) from a CA, export
   as `.p12`/`.pfx`.
3. Add these repository secrets (Settings → Secrets → Actions):
   - `CSC_LINK` — base64 of the `.p12` (`base64 -i cert.p12`)
   - `CSC_KEY_PASSWORD` — the `.p12` password
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for
     notarization (app-specific password from appleid.apple.com)
4. That's it — `release.yml` already passes these through; electron-builder
   signs when `CSC_LINK` exists and notarizes when the Apple secrets exist.
   Signed builds also unlock macOS auto-updates (Squirrel.Mac refuses
   unsigned apps) and let the README's SmartScreen/Gatekeeper caveats be
   removed.

## Homebrew cask

After the first signed release exists:

1. Fill `homebrew/resolume-discord-rpc.rb` — version and
   `shasum -a 256 <dmg>`.
2. Either submit to https://github.com/Homebrew/homebrew-cask or create a
   personal tap (`PHPxCODER/homebrew-tap`) and drop the cask in `Casks/`.
   (A personal tap has no notability bar; homebrew-cask requires the app to
   be somewhat established.)

## winget

After the first **signed** Windows release (winget moderation effectively
requires signed installers):

1. Fill `winget/` manifests — version, installer URL, and
   `Get-FileHash <exe> -Algorithm SHA256`.
2. Submit a PR to https://github.com/microsoft/winget-pkgs under
   `manifests/p/PHPxCODER/ResolumeDiscordRPC/<version>/`, or use
   `wingetcreate update`.
