import { EventEmitter } from 'node:events';

export interface CompositionUpdate {
  compositionName: string;
  layerName: string | null;
  clipName: string | null;
  bpm: number;
}

export type FetchImpl = typeof fetch;

export const PUSH_POLL_DELAY_MS = 2000;

export interface CompositionSocket {
  addEventListener(type: 'message' | 'close' | 'error', listener: () => void): void;
  close(): void;
}

export type CreateWebSocket = (url: string) => CompositionSocket | null;

// Node >= 22 (and Electron's main process) ships a global WebSocket; on
// older runtimes the watcher silently stays polling-only.
function defaultCreateWebSocket(url: string): CompositionSocket | null {
  if (typeof WebSocket === 'undefined') return null;
  return new WebSocket(url) as unknown as CompositionSocket;
}

export interface CompositionWatcherOptions {
  port: number;
  pollIntervalMs?: number;
  fetchImpl?: FetchImpl;
  createWebSocket?: CreateWebSocket;
}

export interface CompositionWatcherEvents {
  update: [CompositionUpdate];
  unavailable: [];
}

interface CompositionApiClip {
  name?: { value?: unknown };
  connected?: { index?: unknown };
}

interface CompositionApiLayer {
  name: { value: string };
  selected: { value: boolean };
  clips?: CompositionApiClip[];
}

interface CompositionApiResponse {
  name: { value: string };
  layers: CompositionApiLayer[];
  tempocontroller: { tempo: { value: number } };
}

function updatesEqual(a: CompositionUpdate, b: CompositionUpdate): boolean {
  return (
    a.compositionName === b.compositionName &&
    a.layerName === b.layerName &&
    a.clipName === b.clipName &&
    a.bpm === b.bpm
  );
}

// A clip's `connected` ParamState has the fixed options ["Empty",
// "Disconnected", "Previewing", "Connected", "Connected & previewing"], so
// index >= 3 means the clip is live in the output. Layers are bottom-up in
// the API (layers[0] is Layer 1), so scan from the end to prefer the
// topmost — most visible — playing clip. Clips are a tolerant enrichment:
// any missing or unexpected clip data just means "no clip", never an error.
function findPlayingClipName(layers: CompositionApiLayer[]): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const clips = layers[i].clips;
    if (!Array.isArray(clips)) continue;
    for (const clip of clips) {
      const index = clip?.connected?.index;
      if (typeof index !== 'number' || index < 3) continue;
      const name = clip?.name?.value;
      if (typeof name === 'string' && name.trim() !== '') return name.trim();
    }
  }
  return null;
}

export class CompositionWatcher extends EventEmitter {
  port: number;
  pollIntervalMs: number;
  fetchImpl: FetchImpl;
  createWebSocket: CreateWebSocket;
  private _timer: ReturnType<typeof setInterval> | null;
  private _lastUpdate: CompositionUpdate | null;
  private _socket: CompositionSocket | null;
  private _pushPollTimer: ReturnType<typeof setTimeout> | null;

  override on<K extends keyof CompositionWatcherEvents>(
    event: K,
    listener: (...args: CompositionWatcherEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof CompositionWatcherEvents>(event: K, ...args: CompositionWatcherEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  constructor({
    port,
    pollIntervalMs = 15000,
    fetchImpl = fetch,
    createWebSocket = defaultCreateWebSocket,
  }: CompositionWatcherOptions) {
    super();
    this.port = port;
    this.pollIntervalMs = pollIntervalMs;
    this.fetchImpl = fetchImpl;
    this.createWebSocket = createWebSocket;
    this._timer = null;
    this._lastUpdate = null;
    this._socket = null;
    this._pushPollTimer = null;
  }

  // The WebSocket is only a change signal: Resolume pushes a message on any
  // state change (and a burst on connect), and each message schedules one
  // debounced REST re-poll. Interval polling stays as the always-on
  // fallback, and doubles as the reconnect cadence when the socket dies.
  private _connectSocket(): void {
    if (this._socket) return;
    let socket: CompositionSocket | null;
    try {
      socket = this.createWebSocket(`ws://localhost:${this.port}/api/v1`);
    } catch {
      socket = null;
    }
    if (!socket) return;
    this._socket = socket;
    socket.addEventListener('message', () => this._schedulePushPoll());
    socket.addEventListener('close', () => this._dropSocket());
    socket.addEventListener('error', () => this._dropSocket());
  }

  private _dropSocket(): void {
    this._socket = null;
  }

  private _schedulePushPoll(): void {
    if (this._pushPollTimer) return;
    this._pushPollTimer = setTimeout(() => {
      this._pushPollTimer = null;
      this.poll().catch(() => {});
    }, PUSH_POLL_DELAY_MS);
  }

  async poll(): Promise<void> {
    let update: CompositionUpdate;
    try {
      const response = await this.fetchImpl(`http://localhost:${this.port}/api/v1/composition`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as CompositionApiResponse;

      const isValid =
        typeof data.name?.value === 'string' &&
        Array.isArray(data.layers) &&
        typeof data.tempocontroller?.tempo?.value === 'number' &&
        Number.isFinite(data.tempocontroller.tempo.value);
      if (!isValid) throw new Error('Unexpected response shape from Resolume composition API');

      const selectedLayerIndex = data.layers.findIndex((layer) => layer.selected.value === true);
      const selectedLayer = selectedLayerIndex === -1 ? null : data.layers[selectedLayerIndex];

      // Resolume treats "#" in a layer name as a live template token for
      // the layer's number, substituted client-side by its own UI — the
      // REST API returns it unsubstituted, whether the layer is still on
      // its default name ("Layer #") or the user renamed it and kept the
      // token ("Base Layer #"). Confirmed against a live Arena instance
      // for both cases. Replace every "#" with the layer's 1-based
      // position; a name with no "#" (the user removed the token) is
      // left untouched.
      const layerName = selectedLayer
        ? selectedLayer.name.value.replace(/#/g, String(selectedLayerIndex + 1))
        : null;

      update = {
        compositionName: data.name.value,
        layerName,
        clipName: findPlayingClipName(data.layers),
        bpm: Math.round(data.tempocontroller.tempo.value),
      };
    } catch {
      this._lastUpdate = null;
      this.emit('unavailable');
      return;
    }

    if (!this._lastUpdate || !updatesEqual(this._lastUpdate, update)) {
      this._lastUpdate = update;
      this.emit('update', update);
    }
  }

  start(): void {
    if (this._timer) return;
    this.poll().catch(() => {});
    this._connectSocket();
    this._timer = setInterval(() => {
      this._connectSocket();
      this.poll().catch(() => {});
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._lastUpdate = null;
    if (this._pushPollTimer) clearTimeout(this._pushPollTimer);
    this._pushPollTimer = null;
    if (this._socket) {
      try {
        this._socket.close();
      } catch {
        // a socket that fails to close is already dead
      }
      this._socket = null;
    }
  }
}
