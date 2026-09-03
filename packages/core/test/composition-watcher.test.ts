import { describe, it, expect, vi } from 'vitest';
import { CompositionWatcher } from '../src/composition-watcher';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function compositionPayload({
  compositionName = 'MyShow',
  layers = [{ name: { value: 'Layer 1' }, selected: { value: true } }],
  bpm = 128,
}: {
  compositionName?: string;
  layers?: Array<{ name: { value: string }; selected: { value: boolean } }>;
  bpm?: number;
} = {}) {
  return {
    name: { value: compositionName },
    layers,
    tempocontroller: { tempo: { value: bpm } },
  };
}

describe('CompositionWatcher', () => {
  it('emits "update" with the composition name, selected layer, and rounded bpm on a successful poll', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(compositionPayload({ compositionName: 'MyShow', bpm: 127.6 }))
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/composition',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(update).toHaveBeenCalledExactlyOnceWith({
      compositionName: 'MyShow',
      layerName: 'Layer 1',
      bpm: 128,
    });
  });

  it('substitutes the layer\'s 1-based position for the "#" in the default "Layer #" name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [
            { name: { value: 'Layer #' }, selected: { value: false } },
            { name: { value: 'Layer #' }, selected: { value: true } },
            { name: { value: 'Layer #' }, selected: { value: false } },
          ],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ layerName: 'Layer 2' })
    );
  });

  it('substitutes an embedded "#" in a renamed layer too, since Resolume keeps it as a live number token', async () => {
    // Renaming a layer in Resolume sets a prefix but the API still returns
    // the "#" token embedded in the name (confirmed against a live Arena
    // instance: renaming a layer to "Base Layer" reports name.value as
    // literally "Base Layer #", not "Base Layer").
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [{ name: { value: 'Base Layer #' }, selected: { value: true } }],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ layerName: 'Base Layer 1' })
    );
  });

  it('leaves a renamed layer with no "#" token completely untouched', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [{ name: { value: 'Background' }, selected: { value: true } }],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ layerName: 'Background' })
    );
  });

  it('reports layerName as null when no layer is selected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [
            { name: { value: 'Layer 1' }, selected: { value: false } },
            { name: { value: 'Layer 2' }, selected: { value: false } },
          ],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ layerName: null })
    );
  });

  it('emits "unavailable" when the fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('emits "unavailable" when the response is not ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({}, false, 404));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('emits "unavailable" when the response body does not match the expected shape', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ unexpected: true }));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('does not re-emit "update" on repeated polls when nothing changed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('re-emits "update" when the composition name changes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(compositionPayload({ compositionName: 'Show A' })))
      .mockResolvedValueOnce(fakeResponse(compositionPayload({ compositionName: 'Show B' })));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('re-emits "update" after recovering from an outage, even with the same values as before', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(compositionPayload()))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    await watcher.poll();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('start() polls immediately then on an interval; stop() cancels it', () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, pollIntervalMs: 15000, fetchImpl });

    watcher.start();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    watcher.stop();
    vi.advanceTimersByTime(15000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('re-emits "update" after stop()+restart, even with the same values as before', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    watcher.stop();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('propagates a throwing "update" listener instead of misreporting it as "unavailable"', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const unavailable = vi.fn();
    watcher.on('unavailable', unavailable);
    watcher.on('update', () => {
      throw new Error('listener bug');
    });

    await expect(watcher.poll()).rejects.toThrow('listener bug');

    expect(unavailable).not.toHaveBeenCalled();
  });

  it('emits "unavailable" when fields are present but have the wrong type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse({ name: {}, layers: [], tempocontroller: { tempo: { value: null } } })
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    const unavailable = vi.fn();
    watcher.on('update', update);
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(update).not.toHaveBeenCalled();
    expect(unavailable).toHaveBeenCalledTimes(1);
  });

  it('does not produce an unhandled rejection when a start()-driven poll\'s "update" listener throws', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, pollIntervalMs: 15000, fetchImpl });
    watcher.on('update', () => {
      throw new Error('listener bug');
    });

    expect(() => watcher.start()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    expect(() => watcher.stop()).not.toThrow();
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
