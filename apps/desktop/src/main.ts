import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { Detector, Presence } from '@resolume-discord-rpc/core';
import { DISCORD_CLIENT_ID } from './constants';
import { isAutoStartEnabled, setAutoStart, applyStoredAutoStartSetting } from './autostart';

app.setName('Resolume Discord RPC');

let tray: Tray | null = null;
const detector = new Detector();
const presence = new Presence({ clientId: DISCORD_CLIENT_ID });

function assetPath(name: string): string {
  return path.join(__dirname, '..', '..', 'assets', name);
}

function setTrayState(label: string): void {
  if (!tray) return;
  tray.setToolTip(`Resolume Discord RPC — ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label, enabled: false },
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
  setTrayState('Waiting for Resolume Arena…');
}

detector.on('detected', () => {
  presence.showActivity();
  tray?.setImage(nativeImage.createFromPath(assetPath('tray-connected.png')));
  setTrayState('Connected — In Resolume Arena');
});

detector.on('lost', () => {
  presence.clearActivity();
  tray?.setImage(nativeImage.createFromPath(assetPath('tray-idle.png')));
  setTrayState('Waiting for Resolume Arena…');
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide();
  createTray();
  applyStoredAutoStartSetting();
  detector.start();
});

app.on('before-quit', () => {
  detector.stop();
  presence.destroy();
});

app.on('window-all-closed', () => {
  // Tray-only app: there are no windows, so never quit on this event.
});
