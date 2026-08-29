import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import api from './api';

// Reach the registered axios v1 response-interceptor rejection handler so we
// can drive it with synthetic errors without a real network round-trip.
type RejectHandler = (error: unknown) => unknown;
const rejectResponse = (
  api.interceptors.response as unknown as { handlers: { rejected: RejectHandler }[] }
).handlers[0].rejected;

function httpError(status: number, data?: unknown) {
  return { response: { status, data } };
}

type CallLog = { mock: { calls: unknown[][] } };

function dispatchedEventTypes(spy: CallLog): string[] {
  return spy.mock.calls.map(call => (call[0] as Event).type);
}

let dispatchSpy: CallLog;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('auth_token', 'tok');
  localStorage.setItem('auth_user', '{"id":1}');
  dispatchSpy = vi.spyOn(window, 'dispatchEvent') as unknown as CallLog;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lib/api — axios instance', () => {
  it('has a bounded default request timeout', () => {
    expect(api.defaults.timeout).toBe(15000);
  });

  it('does not import the auth store (interceptor stays decoupled)', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'api.ts'), 'utf8');
    expect(src).not.toMatch(/useAuthStore|@\/store\//);
  });
});

describe('lib/api — response interceptor on 401', () => {
  it('clears auth storage and emits auth:session-revoked (intent only)', async () => {
    await expect(rejectResponse(httpError(401))).rejects.toBeDefined();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
    expect(dispatchedEventTypes(dispatchSpy)).toContain('auth:session-revoked');
    expect(dispatchedEventTypes(dispatchSpy)).not.toContain('auth:subscription-suspect');
    expect(dispatchedEventTypes(dispatchSpy)).not.toContain('session-expired');
  });
});

describe('lib/api — response interceptor on 403', () => {
  it('emits auth:subscription-suspect for a known SUBSCRIPTION_ code', async () => {
    await expect(
      rejectResponse(httpError(403, { code: 'SUBSCRIPTION_EXPIRED' })),
    ).rejects.toBeDefined();

    expect(dispatchedEventTypes(dispatchSpy)).toContain('auth:subscription-suspect');
    expect(dispatchedEventTypes(dispatchSpy)).not.toContain('auth:session-revoked');
    // never latches subscription state directly
    expect(dispatchedEventTypes(dispatchSpy)).not.toContain('subscription-expired');
  });

  it('emits auth:subscription-suspect for NO_SUBSCRIPTION', async () => {
    await expect(
      rejectResponse(httpError(403, { code: 'NO_SUBSCRIPTION' })),
    ).rejects.toBeDefined();
    expect(dispatchedEventTypes(dispatchSpy)).toContain('auth:subscription-suspect');
  });

  it('emits auth:subscription-suspect for an unknown 403 code', async () => {
    await expect(
      rejectResponse(httpError(403, { code: 'SOME_FUTURE_CODE' })),
    ).rejects.toBeDefined();
    expect(dispatchedEventTypes(dispatchSpy)).toContain('auth:subscription-suspect');
  });

  it('emits auth:subscription-suspect for a 403 with no code at all', async () => {
    await expect(rejectResponse(httpError(403))).rejects.toBeDefined();
    expect(dispatchedEventTypes(dispatchSpy)).toContain('auth:subscription-suspect');
  });

  it('does not clear auth storage on 403', async () => {
    await expect(
      rejectResponse(httpError(403, { code: 'SUBSCRIPTION_SUSPENDED' })),
    ).rejects.toBeDefined();
    expect(localStorage.getItem('auth_token')).toBe('tok');
  });
});

describe('lib/api — response interceptor on other statuses', () => {
  it('emits nothing for a 500', async () => {
    await expect(rejectResponse(httpError(500))).rejects.toBeDefined();
    expect(dispatchedEventTypes(dispatchSpy)).not.toContain('auth:session-revoked');
    expect(dispatchedEventTypes(dispatchSpy)).not.toContain('auth:subscription-suspect');
  });
});
