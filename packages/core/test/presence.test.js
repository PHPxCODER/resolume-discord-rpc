import { describe, it, expect, vi } from 'vitest';
import { Presence, ACTIVITY_DEFAULTS, RECONNECT_DELAY_MS } from '../src/presence.js';

function createFakeClient({ shouldFailLogin = false } = {}) {
  const listeners = {};
  const setActivity = vi.fn().mockResolvedValue({});
  const clearActivity = vi.fn().mockResolvedValue(undefined);
  const destroy = vi.fn().mockResolvedValue(undefined);

  return {
    on(event, handler) {
      listeners[event] = handler;
    },
    login: vi.fn(() => {
      if (shouldFailLogin) return Promise.reject(new Error('Discord not running'));
      listeners.ready?.();
      return Promise.resolve();
    }),
    destroy,
    user: { setActivity, clearActivity },
  };
}

describe('Presence', () => {
  it('connects and applies the activity when showActivity is called', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity(new Date('2026-01-01T00:00:00Z'));

    expect(fakeClient.login).toHaveBeenCalledTimes(1);
    expect(fakeClient.user.setActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        ...ACTIVITY_DEFAULTS,
        startTimestamp: new Date('2026-01-01T00:00:00Z'),
      })
    );
    expect(presence.status).toBe('connected');
  });

  it('does not log in again if already connected', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity();
    presence.showActivity();

    expect(fakeClient.login).toHaveBeenCalledTimes(1);
  });

  it('clears the activity without destroying the connection', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity();
    presence.clearActivity();

    expect(fakeClient.user.clearActivity).toHaveBeenCalledTimes(1);
    expect(fakeClient.destroy).not.toHaveBeenCalled();
  });

  it('destroy() clears state and closes the connection', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity();
    presence.destroy();

    expect(fakeClient.destroy).toHaveBeenCalledTimes(1);
    expect(presence.status).toBe('disconnected');
  });

  it('schedules a reconnect after a failed login', async () => {
    vi.useFakeTimers();
    let createCount = 0;
    const presence = new Presence({
      clientId: 'abc',
      createClient: () => {
        createCount += 1;
        return createFakeClient({ shouldFailLogin: createCount === 1 });
      },
    });

    presence.showActivity();
    await Promise.resolve(); // flush the rejected login's microtask
    await Promise.resolve();
    expect(createCount).toBe(1);
    expect(presence.status).toBe('disconnected');

    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    expect(createCount).toBe(2);
    expect(presence.status).toBe('connected');

    vi.useRealTimers();
  });
});
