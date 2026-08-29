import { describe, expect, it } from 'vitest';
import { authTransition, type AuthEvent, type AuthStatus } from './authMachine';

// Design D1 transition table (empty cell = no-op / stay):
// | from \ event          | BOOT_NO_TOKEN   | BOOT_HAS_TOKEN | SUBSCRIPTION_CHECKED{b} / RECHECK_RESULT{b} | LOGIN_OK{b}                       | MUST_CHANGE_PW       | SESSION_REVOKED         | LOGOUT          |
// | booting               | unauthenticated | booting        | b ? subscription-blocked : authenticated   | -                                | -                   | unauthenticated         | unauthenticated |
// | unauthenticated       | -               | -              | -                                          | b ? subscription-blocked : authed | must-change-password | -                      | unauthenticated |
// | must-change-password  | -               | -              | -                                          | b ? subscription-blocked : authed | must-change-password | -                      | unauthenticated |
// | authenticated         | -               | -              | b ? subscription-blocked : authenticated   | -                                | -                   | session-ending          | unauthenticated |
// | subscription-blocked  | -               | -              | b ? subscription-blocked : authenticated   | -                                | -                   | session-ending          | unauthenticated |
// | session-ending        | -               | -              | -                                          | -                                | -                   | session-ending (coalesce) | unauthenticated |

const ALL_STATUSES: AuthStatus[] = [
  'booting',
  'unauthenticated',
  'must-change-password',
  'subscription-blocked',
  'authenticated',
  'session-ending',
];

describe('authTransition — transition table', () => {
  describe('from booting', () => {
    it('BOOT_NO_TOKEN -> unauthenticated', () => {
      expect(authTransition('booting', { type: 'BOOT_NO_TOKEN' })).toBe('unauthenticated');
    });

    it('BOOT_HAS_TOKEN -> booting (stays)', () => {
      expect(authTransition('booting', { type: 'BOOT_HAS_TOKEN' })).toBe('booting');
    });

    it('SUBSCRIPTION_CHECKED{blocked:false} -> authenticated', () => {
      expect(authTransition('booting', { type: 'SUBSCRIPTION_CHECKED', blocked: false })).toBe(
        'authenticated',
      );
    });

    it('SUBSCRIPTION_CHECKED{blocked:true} -> subscription-blocked', () => {
      expect(authTransition('booting', { type: 'SUBSCRIPTION_CHECKED', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('RECHECK_RESULT{blocked:false} -> authenticated', () => {
      expect(authTransition('booting', { type: 'RECHECK_RESULT', blocked: false })).toBe(
        'authenticated',
      );
    });

    it('RECHECK_RESULT{blocked:true} -> subscription-blocked', () => {
      expect(authTransition('booting', { type: 'RECHECK_RESULT', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('LOGOUT -> unauthenticated', () => {
      expect(authTransition('booting', { type: 'LOGOUT' })).toBe('unauthenticated');
    });

    it('SESSION_REVOKED -> unauthenticated (server-revoked token at boot; never got in, silent bounce to /login)', () => {
      expect(authTransition('booting', { type: 'SESSION_REVOKED' })).toBe('unauthenticated');
    });

    it('LOGIN_OK -> booting (no-op)', () => {
      expect(authTransition('booting', { type: 'LOGIN_OK', blocked: false })).toBe('booting');
    });

    it('MUST_CHANGE_PW -> booting (no-op)', () => {
      expect(authTransition('booting', { type: 'MUST_CHANGE_PW' })).toBe('booting');
    });
  });

  describe('from unauthenticated', () => {
    it('LOGIN_OK{blocked:false} -> authenticated', () => {
      expect(authTransition('unauthenticated', { type: 'LOGIN_OK', blocked: false })).toBe(
        'authenticated',
      );
    });

    it('LOGIN_OK{blocked:true} -> subscription-blocked', () => {
      expect(authTransition('unauthenticated', { type: 'LOGIN_OK', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('MUST_CHANGE_PW -> must-change-password', () => {
      expect(authTransition('unauthenticated', { type: 'MUST_CHANGE_PW' })).toBe(
        'must-change-password',
      );
    });

    it('LOGOUT -> unauthenticated (stays)', () => {
      expect(authTransition('unauthenticated', { type: 'LOGOUT' })).toBe('unauthenticated');
    });

    it('SESSION_REVOKED -> unauthenticated (no-op)', () => {
      expect(authTransition('unauthenticated', { type: 'SESSION_REVOKED' })).toBe('unauthenticated');
    });

    it('SUBSCRIPTION_CHECKED -> unauthenticated (no-op)', () => {
      expect(
        authTransition('unauthenticated', { type: 'SUBSCRIPTION_CHECKED', blocked: true }),
      ).toBe('unauthenticated');
    });

    it('BOOT_NO_TOKEN -> unauthenticated (no-op)', () => {
      expect(authTransition('unauthenticated', { type: 'BOOT_NO_TOKEN' })).toBe('unauthenticated');
    });
  });

  describe('from must-change-password', () => {
    it('LOGIN_OK{blocked:false} -> authenticated', () => {
      expect(authTransition('must-change-password', { type: 'LOGIN_OK', blocked: false })).toBe(
        'authenticated',
      );
    });

    it('LOGIN_OK{blocked:true} -> subscription-blocked', () => {
      expect(authTransition('must-change-password', { type: 'LOGIN_OK', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('MUST_CHANGE_PW -> must-change-password (stays)', () => {
      expect(authTransition('must-change-password', { type: 'MUST_CHANGE_PW' })).toBe(
        'must-change-password',
      );
    });

    it('LOGOUT -> unauthenticated', () => {
      expect(authTransition('must-change-password', { type: 'LOGOUT' })).toBe('unauthenticated');
    });

    it('SESSION_REVOKED -> must-change-password (no-op)', () => {
      expect(authTransition('must-change-password', { type: 'SESSION_REVOKED' })).toBe(
        'must-change-password',
      );
    });
  });

  describe('from authenticated', () => {
    it('SUBSCRIPTION_CHECKED{blocked:true} -> subscription-blocked', () => {
      expect(authTransition('authenticated', { type: 'SUBSCRIPTION_CHECKED', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('SUBSCRIPTION_CHECKED{blocked:false} -> authenticated (stays)', () => {
      expect(authTransition('authenticated', { type: 'SUBSCRIPTION_CHECKED', blocked: false })).toBe(
        'authenticated',
      );
    });

    it('RECHECK_RESULT{blocked:true} -> subscription-blocked', () => {
      expect(authTransition('authenticated', { type: 'RECHECK_RESULT', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('SESSION_REVOKED -> session-ending', () => {
      expect(authTransition('authenticated', { type: 'SESSION_REVOKED' })).toBe('session-ending');
    });

    it('LOGOUT -> unauthenticated', () => {
      expect(authTransition('authenticated', { type: 'LOGOUT' })).toBe('unauthenticated');
    });

    it('LOGIN_OK -> authenticated (no-op)', () => {
      expect(authTransition('authenticated', { type: 'LOGIN_OK', blocked: true })).toBe(
        'authenticated',
      );
    });

    it('MUST_CHANGE_PW -> authenticated (no-op)', () => {
      expect(authTransition('authenticated', { type: 'MUST_CHANGE_PW' })).toBe('authenticated');
    });
  });

  describe('from subscription-blocked', () => {
    it('RECHECK_RESULT{blocked:false} -> authenticated', () => {
      expect(authTransition('subscription-blocked', { type: 'RECHECK_RESULT', blocked: false })).toBe(
        'authenticated',
      );
    });

    it('RECHECK_RESULT{blocked:true} -> subscription-blocked (stays)', () => {
      expect(authTransition('subscription-blocked', { type: 'RECHECK_RESULT', blocked: true })).toBe(
        'subscription-blocked',
      );
    });

    it('SUBSCRIPTION_CHECKED{blocked:false} -> authenticated', () => {
      expect(
        authTransition('subscription-blocked', { type: 'SUBSCRIPTION_CHECKED', blocked: false }),
      ).toBe('authenticated');
    });

    it('SESSION_REVOKED -> session-ending', () => {
      expect(authTransition('subscription-blocked', { type: 'SESSION_REVOKED' })).toBe(
        'session-ending',
      );
    });

    it('LOGOUT -> unauthenticated', () => {
      expect(authTransition('subscription-blocked', { type: 'LOGOUT' })).toBe('unauthenticated');
    });
  });

  describe('from session-ending', () => {
    it('SESSION_REVOKED -> session-ending (coalesce, stays)', () => {
      expect(authTransition('session-ending', { type: 'SESSION_REVOKED' })).toBe('session-ending');
    });

    it('double SESSION_REVOKED stays session-ending', () => {
      const once = authTransition('authenticated', { type: 'SESSION_REVOKED' });
      const twice = authTransition(once, { type: 'SESSION_REVOKED' });
      expect(once).toBe('session-ending');
      expect(twice).toBe('session-ending');
    });

    it('LOGOUT -> unauthenticated', () => {
      expect(authTransition('session-ending', { type: 'LOGOUT' })).toBe('unauthenticated');
    });

    it('SUBSCRIPTION_CHECKED -> session-ending (no-op)', () => {
      expect(
        authTransition('session-ending', { type: 'SUBSCRIPTION_CHECKED', blocked: false }),
      ).toBe('session-ending');
    });

    it('LOGIN_OK -> session-ending (no-op)', () => {
      expect(authTransition('session-ending', { type: 'LOGIN_OK', blocked: false })).toBe(
        'session-ending',
      );
    });
  });
});

describe('authTransition — totality', () => {
  it('LOGOUT from every state -> unauthenticated', () => {
    for (const status of ALL_STATUSES) {
      expect(authTransition(status, { type: 'LOGOUT' })).toBe('unauthenticated');
    }
  });

  it('never throws for any (status, event) pair', () => {
    const events: AuthEvent[] = [
      { type: 'BOOT_NO_TOKEN' },
      { type: 'BOOT_HAS_TOKEN' },
      { type: 'SUBSCRIPTION_CHECKED', blocked: true },
      { type: 'SUBSCRIPTION_CHECKED', blocked: false },
      { type: 'RECHECK_RESULT', blocked: true },
      { type: 'RECHECK_RESULT', blocked: false },
      { type: 'LOGIN_OK', blocked: true },
      { type: 'LOGIN_OK', blocked: false },
      { type: 'MUST_CHANGE_PW' },
      { type: 'SESSION_REVOKED' },
      { type: 'LOGOUT' },
    ];
    for (const status of ALL_STATUSES) {
      for (const event of events) {
        expect(() => authTransition(status, event)).not.toThrow();
        expect(ALL_STATUSES).toContain(authTransition(status, event));
      }
    }
  });

  it('unknown event type returns the current status unchanged', () => {
    const unknown = { type: 'NOT_A_REAL_EVENT' } as unknown as AuthEvent;
    expect(authTransition('authenticated', unknown)).toBe('authenticated');
    expect(authTransition('booting', unknown)).toBe('booting');
  });

  it('unknown status value returns that status unchanged', () => {
    const bogus = 'weird-state' as AuthStatus;
    expect(authTransition(bogus, { type: 'LOGIN_OK', blocked: false })).toBe(bogus);
  });
});
