import { app, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'node:path';
import {
  Detector,
  Presence,
  CompositionWatcher,
  PatchWatcher,
  RESOLUME_PRODUCTS,
  type ResolumeProductId,
  type ResolumeProduct,
} from '@resolume-discord-rpc/core';
import { DISCORD_CLIENT_ID, GITHUB_REPO_URL } from './constants';
import { isAutoStartEnabled, setAutoStart, applyStoredAutoStartSetting } from './autostart';
import {
  getRestPort,
  getWireRestPort,
  isShowLiveDetailsEnabled,
  setShowLiveDetails,
} from './settings';
import { log, logDir } from './logger';
import { startAutoUpdates, quitAndInstall } from './updater';

app.setName('Resolume Discord RPC');

// A second copy of a tray-only app is invisible except as a duplicate tray
// icon fighting over the same Discord RPC socket — bail out immediately.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

const PRODUCTS_BY_ID: Record<ResolumeProductId, ResolumeProduct> = Object.fromEntries(
  RESOLUME_PRODUCTS.map((product) => [product.id, product])
) as Record<ResolumeProductId, ResolumeProduct>;

const REST_CAPABLE_PRODUCTS: ResolumeProductId[] = ['arena', 'avenue'];

let tray: Tray | null = null;
let currentProductId: ResolumeProductId | null = null;
let currentState: string | undefined;
// Tracks availability transitions purely for logging — 'unavailable' fires
// on every poll forever while Resolume's webserver is off, and 'update'
// on every BPM tick, so raw events would flood the log file.
let liveDetailsWereAvailable = false;
let pendingUpdateVersion: string | null = null;
let trayLabel = 'Waiting for Resolume…';
const detector = new Detector();
const presence = new Presence({ clientId: DISCORD_CLIENT_ID });
const compositionWatcher = new CompositionWatcher({ port: getRestPort() });
const patchWatcher = new PatchWatcher({ port: getWireRestPort() });

function assetPath(name: string): string {
  // app.getAppPath() is the directory containing package.json both in dev
  // and inside the packaged asar — unlike __dirname, it doesn't care
  // whether this file runs from out/src/ (dev) or bundle/ (packaged).
  return path.join(app.getAppPath(), 'assets', name);
}

// The "Template" filename suffix makes Electron treat these as macOS
// template images — recolored automatically for light/dark menu bars, with
// the @2x sibling picked up on retina. Other platforms keep the colored set.
function trayIcon(state: 'idle' | 'connected'): Electron.NativeImage {
  const name = process.platform === 'darwin' ? `tray-${state}Template.png` : `tray-${state}.png`;
  return nativeImage.createFromPath(assetPath(name));
}

function showProductActivity(): void {
  if (!currentProductId) return;
  const { label, largeImageKey, websiteUrl } = PRODUCTS_BY_ID[currentProductId];
  presence.showActivity({
    details: `In ${label}`,
    largeImageText: label,
    largeImageKey,
    ...(currentState ? { state: currentState } : {}),
    buttons: [
      { label: 'What is Resolume?', url: websiteUrl },
      { label: 'View on GitHub', url: GITHUB_REPO_URL },
    ],
  });
}

function startWatcherForCurrentProduct(): void {
  if (!currentProductId || !isShowLiveDetailsEnabled()) return;
  if (REST_CAPABLE_PRODUCTS.includes(currentProductId)) compositionWatcher.start();
  else if (currentProductId === 'wire') patchWatcher.start();
}

function stopWatchers(): void {
  compositionWatcher.stop();
  patchWatcher.stop();
  currentState = undefined;
  liveDetailsWereAvailable = false;
}

function logAvailabilityTransition(available: boolean, source: string): void {
  if (available === liveDetailsWereAvailable) return;
  liveDetailsWereAvailable = available;
  log(available ? `${source} live details available` : `${source} unavailable, static presence`);
}

function setTrayState(label: string): void {
  trayLabel = label;
  if (!tray) return;
  tray.setToolTip(`Resolume Discord RPC — ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label, enabled: false },
      { type: 'separator' },
      {
        label: 'Reconnect to Discord',
        click: () => {
          log('manual Discord reconnect requested');
          presence.reconnect();
        },
      },
      { type: 'separator' },
      {
        label: 'Show live details in Discord',
        type: 'checkbox',
        checked: isShowLiveDetailsEnabled(),
        click: (menuItem) => {
          setShowLiveDetails(menuItem.checked);
          log(`live details toggled ${menuItem.checked ? 'on' : 'off'}`);
          if (menuItem.checked) {
            // stop() reset the watcher's dedup state earlier, so a fresh
            // update re-fires even if nothing changed in Resolume.
            startWatcherForCurrentProduct();
          } else {
            stopWatchers();
            showProductActivity();
          }
        },
      },
      {
        label: 'Start with system',
        type: 'checkbox',
        checked: isAutoStartEnabled(),
        click: (menuItem) => {
          log(`start with system toggled ${menuItem.checked ? 'on' : 'off'}`);
          setAutoStart(menuItem.checked);
        },
      },
      { type: 'separator' },
      { label: 'Open logs', click: () => shell.openPath(logDir()) },
      {
        label: `About Resolume Discord RPC (v${app.getVersion()})`,
        click: () => shell.openExternal(GITHUB_REPO_URL),
      },
      { type: 'separator' },
      ...(pendingUpdateVersion
        ? [{ label: `Restart to update to v${pendingUpdateVersion}`, click: () => quitAndInstall() }]
        : []),
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

function createTray(): void {
  tray = new Tray(trayIcon('idle'));
  setTrayState('Waiting for Resolume…');
}

detector.on('detected', (productId) => {
  log(`detected ${productId}`);
  currentProductId = productId;
  currentState = undefined;
  showProductActivity();
  tray?.setImage(trayIcon('connected'));
  setTrayState(`Connected — In ${PRODUCTS_BY_ID[productId].label}`);
  startWatcherForCurrentProduct();
});

detector.on('lost', () => {
  log('resolume process lost');
  currentProductId = null;
  stopWatchers();
  presence.clearActivity();
  tray?.setImage(trayIcon('idle'));
  setTrayState('Waiting for Resolume…');
});

compositionWatcher.on('update', ({ compositionName, layerName, clipName, bpm }) => {
  if (!currentProductId) return;
  logAvailabilityTransition(true, 'composition API');
  currentState = [compositionName, layerName, clipName && `▶ ${clipName}`, `${bpm} BPM`]
    .filter(Boolean)
    .join(' · ');
  showProductActivity();
});

compositionWatcher.on('unavailable', () => {
  if (!currentProductId) return;
  logAvailabilityTransition(false, 'composition API');
  if (currentState === undefined) return;
  currentState = undefined;
  showProductActivity();
});

patchWatcher.on('update', ({ patchName }) => {
  if (!currentProductId) return;
  logAvailabilityTransition(true, 'Wire patch API');
  currentState = patchName ? `Editing: ${patchName}` : undefined;
  showProductActivity();
});

patchWatcher.on('unavailable', () => {
  if (!currentProductId) return;
  logAvailabilityTransition(false, 'Wire patch API');
  if (currentState === undefined) return;
  currentState = undefined;
  showProductActivity();
});

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return;
  log(`app start v${app.getVersion()} (${process.platform})`);
  if (process.platform === 'darwin') app.dock?.hide();
  createTray();
  applyStoredAutoStartSetting();
  detector.start();
  startAutoUpdates((version) => {
    log(`update v${version} downloaded, offering restart via tray`);
    pendingUpdateVersion = version;
    setTrayState(trayLabel); // rebuild the menu with the restart item
  });
});

app.on('before-quit', () => {
  log('app quit');
  detector.stop();
  stopWatchers();
  presence.destroy();
});

app.on('window-all-closed', () => {
  // Tray-only app: there are no windows, so never quit on this event.
});
