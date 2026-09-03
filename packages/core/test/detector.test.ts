import { describe, it, expect, vi } from 'vitest';
import { Detector, parseWindowsTasklist, parseUnixPgrep, RESOLUME_PRODUCTS } from '../src/detector';

describe('parseWindowsTasklist', () => {
  it('returns "arena" when Arena.exe is in the tasklist output', () => {
    const output = '\n"Arena.exe","12345","Console","1","250,000 K"\n';
    expect(parseWindowsTasklist(output)).toBe('arena');
  });

  it('returns "avenue" when Avenue.exe is in the tasklist output', () => {
    const output = '\n"Avenue.exe","12345","Console","1","250,000 K"\n';
    expect(parseWindowsTasklist(output)).toBe('avenue');
  });

  it('returns "wire" when Wire.exe is in the tasklist output', () => {
    const output = '\n"Wire.exe","12345","Console","1","250,000 K"\n';
    expect(parseWindowsTasklist(output)).toBe('wire');
  });

  it('returns null when none of the Resolume products are running', () => {
    const output =
      '\n"chrome.exe","111","Console","1","1 K"\n"Explorer.EXE","222","Console","1","1 K"\n';
    expect(parseWindowsTasklist(output)).toBe(null);
  });
});

describe('parseUnixPgrep', () => {
  it('returns "arena" when pgrep -l lists an Arena process', () => {
    expect(parseUnixPgrep('4821 Arena\n')).toBe('arena');
  });

  it('returns "avenue" when pgrep -l lists an Avenue process', () => {
    expect(parseUnixPgrep('4821 Avenue\n')).toBe('avenue');
  });

  it('returns "wire" when pgrep -l lists a Wire process', () => {
    expect(parseUnixPgrep('4821 Wire\n')).toBe('wire');
  });

  it('returns null when pgrep outputs nothing', () => {
    expect(parseUnixPgrep('')).toBe(null);
  });

  it('prefers arena over avenue and wire when multiple are running, regardless of launch order', () => {
    // Wire has the lowest PID here (launched first), but Arena still wins.
    expect(parseUnixPgrep('100 Wire\n200 Avenue\n300 Arena\n')).toBe('arena');
  });

  it('prefers avenue over wire when both are running and arena is not', () => {
    expect(parseUnixPgrep('100 Wire\n200 Avenue\n')).toBe('avenue');
  });
});

describe('RESOLUME_PRODUCTS', () => {
  it('has a label for each of arena, avenue, and wire', () => {
    const ids = RESOLUME_PRODUCTS.map((p) => p.id).sort();
    expect(ids).toEqual(['arena', 'avenue', 'wire']);
  });

  it('gives each product its own distinct Discord large image key', () => {
    const keys = RESOLUME_PRODUCTS.map((p) => p.largeImageKey);
    expect(new Set(keys).size).toBe(RESOLUME_PRODUCTS.length);
    expect(RESOLUME_PRODUCTS.find((p) => p.id === 'arena')?.largeImageKey).toBe('resolume_logo');
    expect(RESOLUME_PRODUCTS.find((p) => p.id === 'avenue')?.largeImageKey).toBe('resolume_avenue_logo');
    expect(RESOLUME_PRODUCTS.find((p) => p.id === 'wire')?.largeImageKey).toBe('resolume_wire_logo');
  });
});

describe('Detector', () => {
  it('emits "detected" with the product id when a Resolume process starts', async () => {
    const runCommand = vi.fn().mockResolvedValue('"Avenue.exe","1","Console","1","1 K"');
    const detector = new Detector({ platform: 'win32', runCommand });
    const detected = vi.fn();
    detector.on('detected', detected);

    await detector.poll();

    expect(detected).toHaveBeenCalledExactlyOnceWith('avenue');
  });

  it('emits "lost" with the product id when a Resolume process stops', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce('"Wire.exe","1","Console","1","1 K"')
      .mockResolvedValueOnce('INFO: No tasks are running which match the specified criteria.');
    const detector = new Detector({ platform: 'win32', runCommand });
    const lost = vi.fn();
    detector.on('lost', lost);

    await detector.poll();
    await detector.poll();

    expect(lost).toHaveBeenCalledExactlyOnceWith('wire');
  });

  it('does not re-emit "detected" on repeated polls while the same product is still running', async () => {
    const runCommand = vi.fn().mockResolvedValue('"Arena.exe","1","Console","1","1 K"');
    const detector = new Detector({ platform: 'win32', runCommand });
    const detected = vi.fn();
    detector.on('detected', detected);

    await detector.poll();
    await detector.poll();

    expect(detected).toHaveBeenCalledTimes(1);
  });

  it('emits "lost" then "detected" when switching directly from one product to another', async () => {
    const runCommand = vi
      .fn()
      .mockResolvedValueOnce('"Arena.exe","1","Console","1","1 K"')
      .mockResolvedValueOnce('"Avenue.exe","2","Console","1","1 K"');
    const detector = new Detector({ platform: 'win32', runCommand });
    const events: string[] = [];
    detector.on('lost', (product) => events.push(`lost:${product}`));
    detector.on('detected', (product) => events.push(`detected:${product}`));

    await detector.poll();
    await detector.poll();

    expect(events).toEqual(['detected:arena', 'lost:arena', 'detected:avenue']);
  });

  it('uses the pgrep parser on darwin', async () => {
    const runCommand = vi.fn().mockResolvedValue('4821 Wire\n');
    const detector = new Detector({ platform: 'darwin', runCommand });
    const detected = vi.fn();
    detector.on('detected', detected);

    await detector.poll();

    expect(runCommand).toHaveBeenCalledWith(expect.stringContaining('pgrep'));
    expect(detected).toHaveBeenCalledExactlyOnceWith('wire');
  });
});
