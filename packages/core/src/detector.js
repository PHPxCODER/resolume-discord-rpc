const { EventEmitter } = require('node:events');
const { exec } = require('node:child_process');
const util = require('node:util');

const execAsync = util.promisify(exec);

const COMMANDS = {
  win32: 'tasklist /FI "IMAGENAME eq Arena.exe" /NH',
  darwin: 'pgrep -x Arena',
};

function parseWindowsTasklist(output) {
  return /arena\.exe/i.test(output) && !/no tasks/i.test(output);
}

function parseUnixPgrep(output) {
  return output.trim().length > 0;
}

async function defaultRunCommand(command) {
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (err) {
    // Commands like `pgrep` exit non-zero when there's no match; Node still
    // attaches stdout to the rejected error, so treat that as "not running".
    return err.stdout || '';
  }
}

class Detector extends EventEmitter {
  constructor({ platform = process.platform, pollIntervalMs = 10000, runCommand = defaultRunCommand } = {}) {
    super();
    this.platform = platform;
    this.pollIntervalMs = pollIntervalMs;
    this.runCommand = runCommand;
    this.isRunning = false;
    this._timer = null;
  }

  async poll() {
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

  start() {
    if (this._timer) return;
    this.poll();
    this._timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }
}

module.exports = { Detector, parseWindowsTasklist, parseUnixPgrep, COMMANDS };
