import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const MAX_LOG_BYTES = 512 * 1024;

export function logDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

function logFile(): string {
  return path.join(logDir(), 'app.log');
}

export function log(message: string): void {
  try {
    fs.mkdirSync(logDir(), { recursive: true });
    const file = logFile();
    try {
      if (fs.statSync(file).size > MAX_LOG_BYTES) {
        fs.renameSync(file, path.join(logDir(), 'app.old.log'));
      }
    } catch {
      // first write — nothing to rotate yet
    }
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // logging must never break the app
  }
}
