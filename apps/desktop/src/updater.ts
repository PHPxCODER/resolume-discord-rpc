import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { log } from './logger';

const FIRST_CHECK_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Updates come from GitHub Releases (electron-builder's publish config).
// macOS refuses to apply updates to unsigned apps (Squirrel.Mac), so until
// builds are signed this effectively only functions on Windows; failures
// are logged, never surfaced as dialogs, and never crash the app.
export function startAutoUpdates(onUpdateDownloaded: (version: string) => void): void {
  if (!app.isPackaged) return; // dev runs have no update feed

  autoUpdater.logger = {
    info: (message: unknown) => log(`updater: ${String(message)}`),
    warn: (message: unknown) => log(`updater warn: ${String(message)}`),
    error: (message: unknown) => log(`updater error: ${String(message)}`),
    debug: () => {},
  };
  autoUpdater.on('update-downloaded', (info) => onUpdateDownloaded(info.version));

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, FIRST_CHECK_DELAY_MS); // let startup settle first
  setInterval(check, CHECK_INTERVAL_MS);
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall();
}
