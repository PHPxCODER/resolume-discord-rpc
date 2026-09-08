# Template — fill version/sha256 from a published GitHub release, then
# submit to homebrew-cask or a personal tap. See ../README.md.
cask "resolume-discord-rpc" do
  version "REPLACE_ME" # e.g. "0.1.0"
  sha256 "REPLACE_ME"  # shasum -a 256 "Resolume Discord RPC-<version>-arm64.dmg"

  url "https://github.com/PHPxCODER/resolume-discord-rpc/releases/download/v#{version}/Resolume.Discord.RPC-#{version}-arm64.dmg"
  name "Resolume Discord RPC"
  desc "Discord Rich Presence for Resolume Arena, Avenue and Wire"
  homepage "https://github.com/PHPxCODER/resolume-discord-rpc"

  auto_updates true # electron-updater handles updates once installed

  app "Resolume Discord RPC.app"

  zap trash: [
    "~/Library/Application Support/Resolume Discord RPC",
  ]
end
