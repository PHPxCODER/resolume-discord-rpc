import { describe, it, expect, vi } from 'vitest';
import { Presence, RECONNECT_DELAY_MS, type DiscordRpcClient } from '../src/presence';

function createFakeClient({ shouldFailLogin = false } = {}): DiscordRpcClient {
  const listeners: Record<string, () => void> = {};
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
  } as unknown as DiscordRpcClient;
}

const ARENA_ACTIVITY = {
  details: 'In Resolume Arena',
  largeImageText: 'Resolume Arena',
  largeImageKey: 'resolume_logo',
};
const AVENUE_ACTIVITY = {
  details: 'In Resolume Avenue',
  largeImageText: 'Resolume Avenue',
  largeImageKey: 'resolume_avenue_logo',
};

describe('Presence', () => {
  it('connects and applies the given activity when showActivity is called', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity(ARENA_ACTIVITY, new Date('2026-01-01T00:00:00Z'));

    expect(fakeClient.login).toHaveBeenCalledTimes(1);
    expect(fakeClient.user.setActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        ...ARENA_ACTIVITY,
        startTimestamp: new Date('2026-01-01T00:00:00Z'),
      })
    );
    expect(presence.status).toBe('connected');
  });

  it('applies the new activity in place when called again with a different product, without re-logging in', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity(ARENA_ACTIVITY);
    presence.showActivity(AVENUE_ACTIVITY);

    expect(fakeClient.login).toHaveBeenCalledTimes(1);
    expect(fakeClient.user.setActivity).toHaveBeenLastCalledWith(
      expect.objectContaining(AVENUE_ACTIVITY)
    );
  });

  it('does not log in again if already connected', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity(ARENA_ACTIVITY);
    presence.showActivity(ARENA_ACTIVITY);

    expect(fakeClient.login).toHaveBeenCalledTimes(1);
  });

  it('clears the activity without destroying the connection', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity(ARENA_ACTIVITY);
    presence.clearActivity();

    expect(fakeClient.user.clearActivity).toHaveBeenCalledTimes(1);
    expect(fakeClient.destroy).not.toHaveBeenCalled();
  });

  it('destroy() clears state and closes the connection', () => {
    const fakeClient = createFakeClient();
    const presence = new Presence({ clientId: 'abc', createClient: () => fakeClient });

    presence.showActivity(ARENA_ACTIVITY);
    presence.destroy();

    expect(fakeClient.destroy).toHaveBeenCalledTimes(1);
    expect(presence.status).toBe('disconnected');
  });

  it('reconnect() destroys the current client and establishes a fresh connection', () => {
    let createCount = 0;
    const clients: DiscordRpcClient[] = [];
    const presence = new Presence({
      clientId: 'abc',
      createClient: () => {
        createCount += 1;
        const client = createFakeClient();
        clients.push(client);
        return client;
      },
    });

    presence.showActivity(ARENA_ACTIVITY);
    expect(createCount).toBe(1);
    expect(presence.status).toBe('connected');

    presence.reconnect();

    expect(clients[0].destroy).toHaveBeenCalledTimes(1);
    expect(createCount).toBe(2);
    expect(presence.status).toBe('connected');
  });

  it('reconnect() re-applies the last shown activity after reconnecting', () => {
    const clients: DiscordRpcClient[] = [];
    const presence = new Presence({
      clientId: 'abc',
      createClient: () => {
        const client = createFakeClient();
        clients.push(client);
        return client;
      },
    });

    presence.showActivity(AVENUE_ACTIVITY);
    presence.reconnect();

    expect(clients[1].user.setActivity).toHaveBeenCalledWith(expect.objectContaining(AVENUE_ACTIVITY));
  });

  it('reconnect() cancels a pending automatic reconnect so the stale timer does not also fire', async () => {
    vi.useFakeTimers();
    let createCount = 0;
    const presence = new Presence({
      clientId: 'abc',
      createClient: () => {
        createCount += 1;
        return createFakeClient({ shouldFailLogin: createCount === 1 });
      },
    });

    presence.showActivity(ARENA_ACTIVITY);
    await Promise.resolve();
    await Promise.resolve();
    expect(createCount).toBe(1);
    expect(presence.status).toBe('disconnected');

    presence.reconnect();
    expect(createCount).toBe(2);
    expect(presence.status).toBe('connected');

    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    expect(createCount).toBe(2);

    vi.useRealTimers();
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

    presence.showActivity(ARENA_ACTIVITY);
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
