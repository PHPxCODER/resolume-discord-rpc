import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';
import util from 'node:util';

const execAsync = util.promisify(exec);

export type Platform = 'win32' | 'darwin' | string;

export type ResolumeProductId = 'arena' | 'avenue' | 'wire';

export interface ResolumeProduct {
  id: ResolumeProductId;
  /** Process name, no extension — e.g. "Arena.exe" on Windows, "Arena" on macOS. */
  processName: string;
  label: string;
  /** Discord Rich Presence art asset key — must be uploaded in the Developer Portal. */
  largeImageKey: string;
  /** Product page, used for the presence "What is Resolume?" button. */
  websiteUrl: string;
}

// Confirmed executable/bundle names via Resolume's own support docs and
// macOS app metadata (resolume.com/support/en/*-installing,
// macupdater.net) — not verified against a real running Avenue/Wire
// process, since neither is installed anywhere this was built.
export const RESOLUME_PRODUCTS: ResolumeProduct[] = [
  {
    id: 'arena',
    processName: 'Arena',
    label: 'Resolume Arena',
    largeImageKey: 'resolume_logo',
    websiteUrl: 'https://resolume.com/software/avenue-arena',
  },
  {
    id: 'avenue',
    processName: 'Avenue',
    label: 'Resolume Avenue',
    largeImageKey: 'resolume_avenue_logo',
    websiteUrl: 'https://resolume.com/software/avenue-arena',
  },
  {
    id: 'wire',
    processName: 'Wire',
    label: 'Resolume Wire',
    largeImageKey: 'resolume_wire_logo',
    websiteUrl: 'https://resolume.com/software/wire',
  },
];

export const COMMANDS: Record<string, string> = {
  win32: 'tasklist /NH',
  darwin: `pgrep -x -l "${RESOLUME_PRODUCTS.map((p) => p.processName).join('|')}"`,
};

export function parseWindowsTasklist(output: string): ResolumeProductId | null {
  for (const product of RESOLUME_PRODUCTS) {
    const pattern = new RegExp(`\\b${product.processName}\\.exe\\b`, 'i');
    if (pattern.test(output)) return product.id;
  }
  return null;
}

export function parseUnixPgrep(output: string): ResolumeProductId | null {
  const runningNames = new Set(
    output
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/)[1])
      .filter(Boolean)
  );

  // Iterate RESOLUME_PRODUCTS (fixed priority order) rather than the pgrep
  // output (PID/launch order), so the same product wins on both platforms
  // when more than one is running — matches parseWindowsTasklist.
  for (const product of RESOLUME_PRODUCTS) {
    if (runningNames.has(product.processName)) return product.id;
  }
  return null;
}

export type RunCommand = (command: string) => Promise<string>;

async function defaultRunCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (err) {
    // Commands like `pgrep` exit non-zero when there's no match; Node still
    // attaches stdout to the rejected error, so treat that as "not running".
    return (err as { stdout?: string }).stdout || '';
  }
}

export interface DetectorEvents {
  detected: [ResolumeProductId];
  lost: [ResolumeProductId];
}

export interface DetectorOptions {
  platform?: Platform;
  pollIntervalMs?: number;
  runCommand?: RunCommand;
}

export class Detector extends EventEmitter {
  platform: Platform;
  pollIntervalMs: number;
  runCommand: RunCommand;
  product: ResolumeProductId | null;
  private _timer: ReturnType<typeof setInterval> | null;

  override on<K extends keyof DetectorEvents>(event: K, listener: (...args: DetectorEvents[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override emit<K extends keyof DetectorEvents>(event: K, ...args: DetectorEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  constructor({
    platform = process.platform,
    pollIntervalMs = 10000,
    runCommand = defaultRunCommand,
  }: DetectorOptions = {}) {
    super();
    this.platform = platform;
    this.pollIntervalMs = pollIntervalMs;
    this.runCommand = runCommand;
    this.product = null;
    this._timer = null;
  }

  get isRunning(): boolean {
    return this.product !== null;
  }

  async poll(): Promise<void> {
    const command = COMMANDS[this.platform];
    if (!command) throw new Error(`Unsupported platform: ${this.platform}`);

    const output = await this.runCommand(command);
    const product = this.platform === 'win32' ? parseWindowsTasklist(output) : parseUnixPgrep(output);

    if (product !== this.product) {
      const previous = this.product;
      this.product = product;
      if (previous) this.emit('lost', previous);
      if (product) this.emit('detected', product);
    }
  }

  start(): void {
    if (this._timer) return;
    this.poll();
    this._timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}
