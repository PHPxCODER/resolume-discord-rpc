const { Client } = require('@xhayper/discord-rpc');

const RECONNECT_DELAY_MS = 15000;

const ACTIVITY_DEFAULTS = {
  details: 'In Resolume Arena',
  largeImageKey: 'resolume_logo',
  largeImageText: 'Resolume Arena',
};

class Presence {
  constructor({ clientId, createClient = () => new Client({ clientId }) } = {}) {
    this.clientId = clientId;
    this.createClient = createClient;
    this.client = null;
    this.status = 'disconnected';
    this.wantsActivity = false;
    this.activityStartedAt = null;
    this._reconnectTimer = null;
  }

  connect() {
    if (this.status !== 'disconnected') return;
    this.status = 'connecting';
    this.client = this.createClient();
    this.client.on('ready', () => this._onReady());
    this.client.on('disconnected', () => this._onDisconnected());
    this.client.login().catch(() => this._onDisconnected());
  }

  _onReady() {
    this.status = 'connected';
    if (this.wantsActivity) this._applyActivity();
  }

  _onDisconnected() {
    this.status = 'disconnected';
    this.client = null;
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  showActivity(startedAt = new Date()) {
    this.wantsActivity = true;
    if (!this.activityStartedAt) this.activityStartedAt = startedAt;
    if (this.status === 'connected') this._applyActivity();
    else if (this.status === 'disconnected') this.connect();
  }

  clearActivity() {
    this.wantsActivity = false;
    this.activityStartedAt = null;
    if (this.status === 'connected') {
      this.client.user.clearActivity().catch(() => {});
    }
  }

  _applyActivity() {
    this.client.user
      .setActivity({ ...ACTIVITY_DEFAULTS, startTimestamp: this.activityStartedAt })
      .catch(() => {});
  }

  destroy() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this.wantsActivity = false;
    if (this.client) {
      this.client.destroy().catch(() => {});
      this.client = null;
    }
    this.status = 'disconnected';
  }
}

module.exports = { Presence, ACTIVITY_DEFAULTS, RECONNECT_DELAY_MS };
