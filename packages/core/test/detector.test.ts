import { describe, it, expect, vi } from 'vitest';
import { Detector, parseWindowsTasklist, parseUnixPgrep } from '../src/detector';

describe('parseWindowsTasklist', () => {
  it('returns true when Arena.exe is in the tasklist output', () => {
    const output = '\n"Arena.exe","12345","Console","1","250,000 K"\n';
    expect(parseWindowsTasklist(output)).toBe(true);
  });

  it('returns false when tasklist reports no matching tasks', () => {
    const output = 'INFO: No tasks are running which match the specified criteria.';
    expect(parseWindowsTasklist(output)).toBe(false);
  });
});

describe('parseUnixPgrep', () => {
  it('returns true when pgrep outputs a pid', () => {
    expect(parseUnixPgrep('4821\n')).toBe(true);
  });

  it('returns false when pgrep outputs nothing', () => {
    expect(parseUnixPgrep('')).toBe(false);
  });
});

describe('Detector', () => {
  it('emits "detected" when Resolume Arena transitions from not-running to running', async () => {
    const runCommand = vi.fn().mockResolvedValue('"Arena.exe","1","Console","1","1 K"');
    const detector = new Detector({ platform: 'win32', runCommand });
    const detected = vi.fn();
    detector.on('detected', detected);

    await detector.poll();

    expect(detected).toHaveBeenCalledTimes(1);
  });

  it('emits "lost" when Resolume Arena transitions from running to not-running', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce('"Arena.exe","1","Console","1","1 K"')
      .mockResolvedValueOnce('INFO: No tasks are running which match the specified criteria.');
    const detector = new Detector({ platform: 'win32', runCommand });
    const lost = vi.fn();
    detector.on('lost', lost);

    await detector.poll();
    await detector.poll();

    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('does not re-emit "detected" on repeated polls while still running', async () => {
    const runCommand = vi.fn().mockResolvedValue('"Arena.exe","1","Console","1","1 K"');
    const detector = new Detector({ platform: 'win32', runCommand });
    const detected = vi.fn();
    detector.on('detected', detected);

    await detector.poll();
    await detector.poll();

    expect(detected).toHaveBeenCalledTimes(1);
  });

  it('uses the pgrep parser on darwin', async () => {
    const runCommand = vi.fn().mockResolvedValue('4821\n');
    const detector = new Detector({ platform: 'darwin', runCommand });
    const detected = vi.fn();
    detector.on('detected', detected);

    await detector.poll();

    expect(runCommand).toHaveBeenCalledWith('pgrep -x Arena');
    expect(detected).toHaveBeenCalledTimes(1);
  });
});
