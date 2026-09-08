// Replace with your Discord Application's Client ID from
// https://discord.com/developers/applications — see Task 6 in
// docs/superpowers/plans/2026-09-03-resolume-discord-rpc-v1.md for setup steps.
export const DISCORD_CLIENT_ID = '1545045400875040829';

// Resolume Arena and Avenue's REST API (Preferences → Webserver).
export const RESOLUME_REST_PORT = 8080;

// Wire's REST API (also behind its Webserver preference) lives on 8081 and
// speaks /api/v2 — verified against a live Wire instance. It has no
// composition/layer/BPM concept, only patch metadata, see
// docs/superpowers/specs/2026-09-03-resolume-rest-api-design.md.
export const RESOLUME_WIRE_REST_PORT = 8081;

export const GITHUB_REPO_URL = 'https://github.com/PHPxCODER/resolume-discord-rpc';
