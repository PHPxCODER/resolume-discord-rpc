import { describe, it, expect, vi } from 'vitest';
import { PatchWatcher } from '../src/patch-watcher';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('PatchWatcher', () => {
  it('emits "update" with the patch name on a successful poll', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ display_name: 'My Patch' }));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8081/api/v2/patch',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(update).toHaveBeenCalledExactlyOnceWith({ patchName: 'My Patch' });
  });

  it('reports patchName as null for an unsaved patch (empty display_name), not unavailable', async () => {
    // A freshly opened, never-saved Wire patch reports display_name as ''
    // (confirmed against a live Wire instance) — that's still a healthy API.
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ display_name: '' }));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const update = vi.fn();
    const unavailable = vi.fn();
    watcher.on('update', update);
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledExactlyOnceWith({ patchName: null });
  });

  it('emits "unavailable" when display_name is missing or not a string', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ display_name: 42 }));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('emits "unavailable" when the fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('emits "unavailable" when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({}, false, 404));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('does not re-emit "update" on repeated polls when the patch name is unchanged', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ display_name: 'My Patch' }));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('re-emits "update" after recovering from an outage, even with the same value as before', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse({ display_name: 'My Patch' }))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(fakeResponse({ display_name: 'My Patch' }));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    await watcher.poll();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('start() polls immediately then on an interval; stop() cancels it', () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ display_name: 'My Patch' }));
    const watcher = new PatchWatcher({ port: 8081, pollIntervalMs: 15000, fetchImpl });

    watcher.start();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    watcher.stop();
    vi.advanceTimersByTime(15000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('re-emits "update" after stop()+restart, even with the same value as before', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ display_name: 'My Patch' }));
    const watcher = new PatchWatcher({ port: 8081, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    watcher.stop();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(2);
  });
});
