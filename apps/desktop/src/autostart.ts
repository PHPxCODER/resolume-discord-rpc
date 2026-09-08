import { app } from 'electron';
import { isAutoStartEnabled, setAutoStartConfig } from './settings';

export { isAutoStartEnabled };

export function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
  setAutoStartConfig(enabled);
}

export function applyStoredAutoStartSetting(): boolean {
  const enabled = isAutoStartEnabled();
  app.setLoginItemSettings({ openAtLogin: enabled });
  return enabled;
}
