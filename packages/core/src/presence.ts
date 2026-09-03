import { Client } from '@xhayper/discord-rpc';

export const RECONNECT_DELAY_MS = 15000;

export interface ActivityDetails {
  details: string;
  largeImageText: string;
  largeImageKey: string;
  state?: string;
}

export interface ActivityPayload extends ActivityDetails {
  startTimestamp?: Date;
}

export interface DiscordRpcClientUser {
  setActivity(activity: ActivityPayload): Promise<unknown>;
  clearActivity(): Promise<unknown>;
}

export interface DiscordRpcClient {
  on(event: 'ready' | 'disconnected', handler: () => void): void;
  login(): Promise<void>;
  destroy(): Promise<void>;
  readonly user: DiscordRpcClientUser;
}

export type PresenceStatus = 'disconnected' | 'connecting' | 'connected';

export interface PresenceOptions {
  clientId: string;
  createClient?: () => DiscordRpcClient;
}

function defaultCreateClient(clientId: string): DiscordRpcClient {
  return new Client({ clientId }) as unknown as DiscordRpcClient;
}

export class Presence {
  clientId: string;
  createClient: () => DiscordRpcClient;
  client: DiscordRpcClient | null;
  status: PresenceStatus;
  wantsActivity: boolean;
  activityStartedAt: Date | null;
  activityDetails: ActivityDetails | null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null;

  constructor({ clientId, createClient }: PresenceOptions) {
    this.clientId = clientId;
    this.createClient = createClient ?? (() => defaultCreateClient(clientId));
    this.client = null;
    this.status = 'disconnected';
    this.wantsActivity = false;
    this.activityStartedAt = null;
    this.activityDetails = null;
    this._reconnectTimer = null;
  }

  connect(): void {
    if (this.status !== 'disconnected') return;
    this.status = 'connecting';
    this.client = this.createClient();
    this.client.on('ready', () => this._onReady());
    this.client.on('disconnected', () => this._onDisconnected());
    this.client.login().catch(() => this._onDisconnected());
  }

  private _onReady(): void {
    this.status = 'connected';
    if (this.wantsActivity) this._applyActivity();
  }

  private _onDisconnected(): void {
    this.status = 'disconnected';
    this.client = null;
    this._scheduleReconnect();
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  reconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.client) {
      this.client.destroy().catch(() => {});
      this.client = null;
    }
    this.status = 'disconnected';
    this.connect();
  }

  showActivity(activity: ActivityDetails, startedAt: Date = new Date()): void {
    this.wantsActivity = true;
    this.activityDetails = activity;
    if (!this.activityStartedAt) this.activityStartedAt = startedAt;
    if (this.status === 'connected') this._applyActivity();
    else if (this.status === 'disconnected') this.connect();
  }

  clearActivity(): void {
    this.wantsActivity = false;
    this.activityStartedAt = null;
    this.activityDetails = null;
    if (this.status === 'connected' && this.client) {
      this.client.user.clearActivity().catch(() => {});
    }
  }

  private _applyActivity(): void {
    if (!this.client || !this.activityDetails) return;
    this.client.user
      .setActivity({
        ...this.activityDetails,
        startTimestamp: this.activityStartedAt ?? undefined,
      })
      .catch(() => {});
  }

  destroy(): void {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this.wantsActivity = false;
    if (this.client) {
      this.client.destroy().catch(() => {});
      this.client = null;
    }
    this.status = 'disconnected';
  }
}
