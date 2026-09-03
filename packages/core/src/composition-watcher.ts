import { EventEmitter } from 'node:events';

export interface CompositionUpdate {
  compositionName: string;
  layerName: string | null;
  bpm: number;
}

export type FetchImpl = typeof fetch;

export interface CompositionWatcherOptions {
  port: number;
  pollIntervalMs?: number;
  fetchImpl?: FetchImpl;
}

export interface CompositionWatcherEvents {
  update: [CompositionUpdate];
  unavailable: [];
}

interface CompositionApiLayer {
  name: { value: string };
  selected: { value: boolean };
}

interface CompositionApiResponse {
  name: { value: string };
  layers: CompositionApiLayer[];
  tempocontroller: { tempo: { value: number } };
}

function updatesEqual(a: CompositionUpdate, b: CompositionUpdate): boolean {
  return a.compositionName === b.compositionName && a.layerName === b.layerName && a.bpm === b.bpm;
}

export class CompositionWatcher extends EventEmitter {
  port: number;
  pollIntervalMs: number;
  fetchImpl: FetchImpl;
  private _timer: ReturnType<typeof setInterval> | null;
  private _lastUpdate: CompositionUpdate | null;

  override on<K extends keyof CompositionWatcherEvents>(
    event: K,
    listener: (...args: CompositionWatcherEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof CompositionWatcherEvents>(event: K, ...args: CompositionWatcherEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  constructor({ port, pollIntervalMs = 15000, fetchImpl = fetch }: CompositionWatcherOptions) {
    super();
    this.port = port;
    this.pollIntervalMs = pollIntervalMs;
    this.fetchImpl = fetchImpl;
    this._timer = null;
    this._lastUpdate = null;
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
    this._timer = setInterval(() => this.poll().catch(() => {}), this.pollIntervalMs);
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._lastUpdate = null;
  }
}
