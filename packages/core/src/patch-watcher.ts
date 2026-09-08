import { EventEmitter } from 'node:events';
import type { FetchImpl } from './composition-watcher';

export interface PatchUpdate {
  patchName: string | null;
}

export interface PatchWatcherOptions {
  port: number;
  pollIntervalMs?: number;
  fetchImpl?: FetchImpl;
}

export interface PatchWatcherEvents {
  update: [PatchUpdate];
  unavailable: [];
}

export class PatchWatcher extends EventEmitter {
  port: number;
  pollIntervalMs: number;
  fetchImpl: FetchImpl;
  private _timer: ReturnType<typeof setInterval> | null;
  private _lastUpdate: PatchUpdate | null;

  override on<K extends keyof PatchWatcherEvents>(
    event: K,
    listener: (...args: PatchWatcherEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof PatchWatcherEvents>(event: K, ...args: PatchWatcherEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  constructor({ port, pollIntervalMs = 15000, fetchImpl = fetch }: PatchWatcherOptions) {
    super();
    this.port = port;
    this.pollIntervalMs = pollIntervalMs;
    this.fetchImpl = fetchImpl;
    this._timer = null;
    this._lastUpdate = null;
  }

  async poll(): Promise<void> {
    let update: PatchUpdate;
    try {
      const response = await this.fetchImpl(`http://localhost:${this.port}/api/v2/patch`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as { display_name?: unknown };

      // Wire's /api/v2/patch is flat JSON; display_name is '' until the
      // patch has been saved (confirmed against a live Wire instance) —
      // treat that as "no name to show", not as an API failure.
      if (typeof data.display_name !== 'string') {
        throw new Error('Unexpected response shape from Wire patch API');
      }

      update = { patchName: data.display_name.trim() || null };
    } catch {
      this._lastUpdate = null;
      this.emit('unavailable');
      return;
    }

    if (!this._lastUpdate || this._lastUpdate.patchName !== update.patchName) {
      this._lastUpdate = update;
      this.emit('update', update);
    }
  }

  start(): void {
    if (this._timer) return;
    this.poll().catch(() => {});
    this._timer = setInterval(() => this.poll().catch(() => {}), this.pollIntervalMs);
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._lastUpdate = null;
  }
}
