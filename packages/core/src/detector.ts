import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';
import util from 'node:util';

const execAsync = util.promisify(exec);

export type Platform = 'win32' | 'darwin' | string;

export const COMMANDS: Record<string, string> = {
  win32: 'tasklist /FI "IMAGENAME eq Arena.exe" /NH',
  darwin: 'pgrep -x Arena',
};

export function parseWindowsTasklist(output: string): boolean {
  return /arena\.exe/i.test(output) && !/no tasks/i.test(output);
}

export function parseUnixPgrep(output: string): boolean {
  return output.trim().length > 0;
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

export interface DetectorOptions {
  platform?: Platform;
  pollIntervalMs?: number;
  runCommand?: RunCommand;
}

export class Detector extends EventEmitter {
  platform: Platform;
  pollIntervalMs: number;
  runCommand: RunCommand;
  isRunning: boolean;
  private _timer: ReturnType<typeof setInterval> | null;

  constructor({
    platform = process.platform,
    pollIntervalMs = 10000,
    runCommand = defaultRunCommand,
  }: DetectorOptions = {}) {
    super();
    this.platform = platform;
    this.pollIntervalMs = pollIntervalMs;
    this.runCommand = runCommand;
    this.isRunning = false;
    this._timer = null;
  }

  async poll(): Promise<void> {
    const command = COMMANDS[this.platform];
    if (!command) throw new Error(`Unsupported platform: ${this.platform}`);

    const output = await this.runCommand(command);
    const nowRunning = this.platform === 'win32' ? parseWindowsTasklist(output) : parseUnixPgrep(output);

    if (nowRunning && !this.isRunning) {
      this.isRunning = true;
      this.emit('detected');
    } else if (!nowRunning && this.isRunning) {
      this.isRunning = false;
      this.emit('lost');
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
