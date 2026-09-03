const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return { autoStart: false };
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

function isAutoStartEnabled() {
  return loadConfig().autoStart === true;
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled });
  saveConfig({ autoStart: enabled });
}

function applyStoredAutoStartSetting() {
  const enabled = isAutoStartEnabled();
  app.setLoginItemSettings({ openAtLogin: enabled });
  return enabled;
}

module.exports = { isAutoStartEnabled, setAutoStart, applyStoredAutoStartSetting, configPath };
