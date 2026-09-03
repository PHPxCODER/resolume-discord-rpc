const { Detector, parseWindowsTasklist, parseUnixPgrep, COMMANDS } = require('./detector');
const { Presence, ACTIVITY_DEFAULTS, RECONNECT_DELAY_MS } = require('./presence');

module.exports = {
  Detector,
  parseWindowsTasklist,
  parseUnixPgrep,
  COMMANDS,
  Presence,
  ACTIVITY_DEFAULTS,
  RECONNECT_DELAY_MS,
};
