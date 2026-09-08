import { describe, it, expect, vi } from 'vitest';
import { CompositionWatcher, PUSH_POLL_DELAY_MS } from '../src/composition-watcher';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

interface PayloadClip {
  name: { value: string };
  connected: { value: string; index: number };
}

interface PayloadLayer {
  name: { value: string };
  selected: { value: boolean };
  clips?: PayloadClip[];
}

// A clip slot's `connected` ParamState, by option index: 0 Empty,
// 1 Disconnected, 2 Previewing, 3 Connected, 4 Connected & previewing.
function clip(name: string, index: number): PayloadClip {
  const options = ['Empty', 'Disconnected', 'Previewing', 'Connected', 'Connected & previewing'];
  return { name: { value: name }, connected: { value: options[index], index } };
}

function compositionPayload({
  compositionName = 'MyShow',
  layers = [{ name: { value: 'Layer 1' }, selected: { value: true } }],
  bpm = 128,
}: {
  compositionName?: string;
  layers?: PayloadLayer[];
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
      clipName: null,
      bpm: 128,
    });
  });

  it('reports the name of a playing clip (connected.index >= 3)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [
            {
              name: { value: 'Layer #' },
              selected: { value: true },
              clips: [clip('Beat 001', 1), clip('Beat 002', 3)],
            },
          ],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ clipName: 'Beat 002' })
    );
  });

  it('prefers the playing clip on the topmost layer (last in the API array)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [
            { name: { value: 'Layer #' }, selected: { value: true }, clips: [clip('Bottom', 3)] },
            { name: { value: 'Layer #' }, selected: { value: false }, clips: [clip('Top', 4)] },
          ],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ clipName: 'Top' }));
  });

  it('does not treat a previewing clip (connected.index 2) as playing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [
            { name: { value: 'Layer #' }, selected: { value: true }, clips: [clip('Preview', 2)] },
          ],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ clipName: null }));
  });

  it('reports clipName as null when layers carry no clips array, without going unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    const unavailable = vi.fn();
    watcher.on('update', update);
    watcher.on('unavailable', unavailable);

    await watcher.poll();

    expect(unavailable).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ clipName: null }));
  });

  it('treats a playing clip with a blank name as no clip', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      fakeResponse(
        compositionPayload({
          layers: [
            { name: { value: 'Layer #' }, selected: { value: true }, clips: [clip('   ', 3)] },
          ],
        })
      )
    );
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();

    expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ clipName: null }));
  });

  it('re-emits "update" when only the playing clip changes', async () => {
    const layerWith = (clipName: string) => [
      { name: { value: 'Layer #' }, selected: { value: true }, clips: [clip(clipName, 3)] },
    ];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(compositionPayload({ layers: layerWith('Beat 001') })))
      .mockResolvedValueOnce(fakeResponse(compositionPayload({ layers: layerWith('Beat 002') })));
    const watcher = new CompositionWatcher({ port: 8080, fetchImpl });
    const update = vi.fn();
    watcher.on('update', update);

    await watcher.poll();
    await watcher.poll();

    expect(update).toHaveBeenCalledTimes(2);
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
    const watcher = new CompositionWatcher({
      port: 8080,
      pollIntervalMs: 15000,
      fetchImpl,
      createWebSocket: () => null,
    });

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

  describe('WebSocket push', () => {
    function fakeSocket() {
      const listeners: Record<string, Array<() => void>> = {};
      return {
        addEventListener(type: string, listener: () => void) {
          (listeners[type] ??= []).push(listener);
        },
        close: vi.fn(),
        fire(type: string) {
          for (const listener of listeners[type] ?? []) listener();
        },
      };
    }

    it('start() opens a WebSocket to the composition API', () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const socket = fakeSocket();
      const createWebSocket = vi.fn().mockReturnValue(socket);
      const watcher = new CompositionWatcher({ port: 8080, fetchImpl, createWebSocket });

      watcher.start();

      expect(createWebSocket).toHaveBeenCalledExactlyOnceWith('ws://localhost:8080/api/v1');
      watcher.stop();
      vi.useRealTimers();
    });

    it('a socket message triggers one extra poll after the debounce delay, not immediately', async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const socket = fakeSocket();
      const watcher = new CompositionWatcher({
        port: 8080,
        pollIntervalMs: 15000,
        fetchImpl,
        createWebSocket: () => socket,
      });

      watcher.start();
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      socket.fire('message');
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(PUSH_POLL_DELAY_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });

    it('a burst of socket messages within the debounce window coalesces into one poll', async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const socket = fakeSocket();
      const watcher = new CompositionWatcher({
        port: 8080,
        pollIntervalMs: 15000,
        fetchImpl,
        createWebSocket: () => socket,
      });

      watcher.start();
      socket.fire('message');
      socket.fire('message');
      socket.fire('message');

      await vi.advanceTimersByTimeAsync(PUSH_POLL_DELAY_MS);
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });

    it('reconnects on the next interval tick after the socket closes', async () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const createWebSocket = vi.fn().mockImplementation(() => fakeSocket());
      const watcher = new CompositionWatcher({
        port: 8080,
        pollIntervalMs: 15000,
        fetchImpl,
        createWebSocket,
      });

      watcher.start();
      expect(createWebSocket).toHaveBeenCalledTimes(1);

      createWebSocket.mock.results[0].value.fire('close');
      await vi.advanceTimersByTimeAsync(15000);
      expect(createWebSocket).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });

    it('stop() closes the socket', () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const socket = fakeSocket();
      const watcher = new CompositionWatcher({ port: 8080, fetchImpl, createWebSocket: () => socket });

      watcher.start();
      watcher.stop();

      expect(socket.close).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('polling still works when the factory returns null', () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const watcher = new CompositionWatcher({
        port: 8080,
        pollIntervalMs: 15000,
        fetchImpl,
        createWebSocket: () => null,
      });

      watcher.start();
      vi.advanceTimersByTime(15000);
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });

    it('polling still works when the factory throws', () => {
      vi.useFakeTimers();
      const fetchImpl = vi.fn().mockResolvedValue(fakeResponse(compositionPayload()));
      const watcher = new CompositionWatcher({
        port: 8080,
        pollIntervalMs: 15000,
        fetchImpl,
        createWebSocket: () => {
          throw new Error('no sockets here');
        },
      });

      expect(() => watcher.start()).not.toThrow();
      vi.advanceTimersByTime(15000);
      expect(fetchImpl).toHaveBeenCalledTimes(2);

      watcher.stop();
      vi.useRealTimers();
    });
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
    const watcher = new CompositionWatcher({
      port: 8080,
      pollIntervalMs: 15000,
      fetchImpl,
      createWebSocket: () => null,
    });
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
