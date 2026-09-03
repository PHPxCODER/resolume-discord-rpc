import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import {
  Detector,
  Presence,
  CompositionWatcher,
  RESOLUME_PRODUCTS,
  type ResolumeProductId,
  type ResolumeProduct,
  type ActivityDetails,
} from '@resolume-discord-rpc/core';
import { DISCORD_CLIENT_ID, RESOLUME_REST_PORT } from './constants';
import { isAutoStartEnabled, setAutoStart, applyStoredAutoStartSetting } from './autostart';

app.setName('Resolume Discord RPC');

const PRODUCTS_BY_ID: Record<ResolumeProductId, ResolumeProduct> = Object.fromEntries(
  RESOLUME_PRODUCTS.map((product) => [product.id, product])
) as Record<ResolumeProductId, ResolumeProduct>;

const REST_CAPABLE_PRODUCTS: ResolumeProductId[] = ['arena', 'avenue'];

let tray: Tray | null = null;
let currentProductId: ResolumeProductId | null = null;
let hasCompositionState = false;
const detector = new Detector();
const presence = new Presence({ clientId: DISCORD_CLIENT_ID });
const compositionWatcher = new CompositionWatcher({ port: RESOLUME_REST_PORT });

function assetPath(name: string): string {
  return path.join(__dirname, '..', '..', 'assets', name);
}

function activityForProduct(productId: ResolumeProductId, state?: string): ActivityDetails {
  const { label, largeImageKey } = PRODUCTS_BY_ID[productId];
  return {
    details: `In ${label}`,
    largeImageText: label,
    largeImageKey,
    ...(state ? { state } : {}),
  };
}

function setTrayState(label: string): void {
  if (!tray) return;
  tray.setToolTip(`Resolume Discord RPC — ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label, enabled: false },
      { type: 'separator' },
      { label: 'Reconnect to Discord', click: () => presence.reconnect() },
      { type: 'separator' },
      {
        label: 'Start with system',
        type: 'checkbox',
        checked: isAutoStartEnabled(),
        click: (menuItem) => setAutoStart(menuItem.checked),
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(assetPath('tray-idle.png')));
  setTrayState('Waiting for Resolume…');
}

detector.on('detected', (productId) => {
  currentProductId = productId;
  presence.showActivity(activityForProduct(productId));
  tray?.setImage(nativeImage.createFromPath(assetPath('tray-connected.png')));
  setTrayState(`Connected — In ${PRODUCTS_BY_ID[productId].label}`);

  if (REST_CAPABLE_PRODUCTS.includes(productId)) {
    compositionWatcher.start();
  }
});

detector.on('lost', () => {
  currentProductId = null;
  hasCompositionState = false;
  compositionWatcher.stop();
  presence.clearActivity();
  tray?.setImage(nativeImage.createFromPath(assetPath('tray-idle.png')));
  setTrayState('Waiting for Resolume…');
});

compositionWatcher.on('update', ({ compositionName, layerName, bpm }) => {
  if (!currentProductId) return;
  const state = [compositionName, layerName, `${bpm} BPM`].filter(Boolean).join(' · ');
  presence.showActivity(activityForProduct(currentProductId, state));
  hasCompositionState = true;
});

compositionWatcher.on('unavailable', () => {
  if (!currentProductId) return;
  if (!hasCompositionState) return;
  presence.showActivity(activityForProduct(currentProductId));
  hasCompositionState = false;
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide();
  createTray();
  applyStoredAutoStartSetting();
  detector.start();
});

app.on('before-quit', () => {
  detector.stop();
  compositionWatcher.stop();
  presence.destroy();
});

app.on('window-all-closed', () => {
  // Tray-only app: there are no windows, so never quit on this event.
});
