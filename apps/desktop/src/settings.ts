import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { RESOLUME_REST_PORT, RESOLUME_WIRE_REST_PORT } from './constants';

interface AppConfig {
  autoStart?: boolean;
  showLiveDetails?: boolean;
  restPort?: number;
  wireRestPort?: number;
}

export function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(patch: Partial<AppConfig>): void {
  fs.writeFileSync(configPath(), JSON.stringify({ ...loadConfig(), ...patch }, null, 2));
}

function portOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : fallback;
}

export function isAutoStartEnabled(): boolean {
  return loadConfig().autoStart === true;
}

export function setAutoStartConfig(enabled: boolean): void {
  saveConfig({ autoStart: enabled });
}

export function isShowLiveDetailsEnabled(): boolean {
  return loadConfig().showLiveDetails !== false;
}

export function setShowLiveDetails(enabled: boolean): void {
  saveConfig({ showLiveDetails: enabled });
}

// The ports have no tray UI — they only matter to users who changed
// Resolume's own webserver port, who can edit config.json (see README)
// and restart the app.
export function getRestPort(): number {
  return portOrDefault(loadConfig().restPort, RESOLUME_REST_PORT);
}

export function getWireRestPort(): number {
  return portOrDefault(loadConfig().wireRestPort, RESOLUME_WIRE_REST_PORT);
}
