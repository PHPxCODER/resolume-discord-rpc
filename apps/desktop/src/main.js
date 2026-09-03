const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { Detector, Presence } = require('@resolume-discord-rpc/core');
const { DISCORD_CLIENT_ID } = require('./constants');
const { isAutoStartEnabled, setAutoStart, applyStoredAutoStartSetting } = require('./autostart');

app.setName('Resolume Discord RPC');

let tray = null;
const detector = new Detector();
const presence = new Presence({ clientId: DISCORD_CLIENT_ID });

function assetPath(name) {
  return path.join(__dirname, '..', 'assets', name);
}

function setTrayState(label) {
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

function createTray() {
  tray = new Tray(nativeImage.createFromPath(assetPath('tray-idle.png')));
  setTrayState('Waiting for Resolume Arena…');
}

detector.on('detected', () => {
  presence.showActivity();
  tray.setImage(nativeImage.createFromPath(assetPath('tray-connected.png')));
  setTrayState('Connected — In Resolume Arena');
});

detector.on('lost', () => {
  presence.clearActivity();
  tray.setImage(nativeImage.createFromPath(assetPath('tray-idle.png')));
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
