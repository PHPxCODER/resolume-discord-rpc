import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

interface AutoStartConfig {
  autoStart: boolean;
}

export function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig(): AutoStartConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return { autoStart: false };
  }
}

function saveConfig(config: AutoStartConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

export function isAutoStartEnabled(): boolean {
  return loadConfig().autoStart === true;
}

export function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
  saveConfig({ autoStart: enabled });
}

export function applyStoredAutoStartSetting(): boolean {
  const enabled = isAutoStartEnabled();
  app.setLoginItemSettings({ openAtLogin: enabled });
  return enabled;
}
