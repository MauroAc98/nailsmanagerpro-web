import { afterEach, describe, expect, it, vi } from 'vitest';
import { logAuthEvent } from './logAuthEvent';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('logAuthEvent', () => {
  it('outside production, warns with the [auth] prefix and the event name', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logAuthEvent('checkSubscription.me-failed', { status: 500 });

    expect(warn).toHaveBeenCalledWith('[auth] checkSubscription.me-failed', { status: 500 });
  });

  it('outside production, passes an empty string when detail is omitted', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logAuthEvent('session-revoked');

    expect(warn).toHaveBeenCalledWith('[auth] session-revoked', '');
  });

  it('in production, does not touch the console', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    logAuthEvent('logout.server-failed', { err: 'timeout' });

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('never throws, in any environment or with any detail', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => logAuthEvent('x')).not.toThrow();
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => logAuthEvent('y', undefined)).not.toThrow();
    expect(() => logAuthEvent('z', new Error('boom'))).not.toThrow();
  });

  it('returns undefined', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(logAuthEvent('anything')).toBeUndefined();
  });
});
