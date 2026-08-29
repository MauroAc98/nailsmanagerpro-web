// Auth state machine — design decision D1.
//
// A hand-rolled, TOTAL transition function holding a single `AuthStatus`.
// - TOTAL: any unknown `(status, event)` pair returns `status` unchanged and
//   never throws. Callers can dispatch freely without guarding.
// - PURE: no side effects. Navigation, storage and API calls live in the
//   store actions that call this reducer, never in here.
//
// The transition table below is authoritative (empty cell = stay / no-op):
//
// | from \ event         | BOOT_NO_TOKEN   | BOOT_HAS_TOKEN | SUBSCRIPTION_CHECKED{b} / RECHECK_RESULT{b} | LOGIN_OK{b}                        | MUST_CHANGE_PW       | SESSION_REVOKED           | LOGOUT          |
// | booting              | unauthenticated | booting        | b ? subscription-blocked : authenticated   | -                                 | -                    | unauthenticated          | unauthenticated |
// | unauthenticated      | -               | -              | -                                          | b ? subscription-blocked : authed | must-change-password | -                        | unauthenticated |
// | must-change-password | -               | -              | -                                          | b ? subscription-blocked : authed | must-change-password | -                        | unauthenticated |
// | authenticated        | -               | -              | b ? subscription-blocked : authenticated   | -                                 | -                    | session-ending           | unauthenticated |
// | subscription-blocked | -               | -              | b ? subscription-blocked : authenticated   | -                                 | -                    | session-ending           | unauthenticated |
// | session-ending       | -               | -              | -                                          | -                                 | -                    | session-ending (coalesce) | unauthenticated |

export type AuthStatus =
  | 'booting'
  | 'unauthenticated'
  | 'must-change-password'
  | 'subscription-blocked'
  | 'authenticated'
  | 'session-ending';

export type AuthEvent =
  | { type: 'BOOT_NO_TOKEN' }
  | { type: 'BOOT_HAS_TOKEN' }
  | { type: 'SUBSCRIPTION_CHECKED'; blocked: boolean }
  | { type: 'RECHECK_RESULT'; blocked: boolean }
  | { type: 'LOGIN_OK'; blocked: boolean }
  | { type: 'MUST_CHANGE_PW' }
  | { type: 'SESSION_REVOKED' }
  | { type: 'LOGOUT' };

function afterSubscriptionResult(blocked: boolean): AuthStatus {
  return blocked ? 'subscription-blocked' : 'authenticated';
}

export function authTransition(status: AuthStatus, event: AuthEvent): AuthStatus {
  // LOGOUT collapses every state to `unauthenticated`.
  if (event.type === 'LOGOUT') return 'unauthenticated';

  switch (status) {
    case 'booting':
      switch (event.type) {
        case 'BOOT_NO_TOKEN':
          return 'unauthenticated';
        case 'BOOT_HAS_TOKEN':
          return 'booting';
        case 'SUBSCRIPTION_CHECKED':
        case 'RECHECK_RESULT':
          return afterSubscriptionResult(event.blocked);
        case 'SESSION_REVOKED':
          // A stored token that the server has already revoked (logged out
          // elsewhere, password changed, tokens pruned). The user never got
          // into the app — there is no dimmed screen to keep and no modal.
          // Bounce silently to `/login?redirect=<origin>`, matching legacy.
          return 'unauthenticated';
        default:
          return status;
      }

    case 'unauthenticated':
      switch (event.type) {
        case 'LOGIN_OK':
          return afterSubscriptionResult(event.blocked);
        case 'MUST_CHANGE_PW':
          return 'must-change-password';
        default:
          return status;
      }

    case 'must-change-password':
      switch (event.type) {
        case 'LOGIN_OK':
          return afterSubscriptionResult(event.blocked);
        case 'MUST_CHANGE_PW':
          return 'must-change-password';
        default:
          return status;
      }

    case 'authenticated':
    case 'subscription-blocked':
      switch (event.type) {
        case 'SUBSCRIPTION_CHECKED':
        case 'RECHECK_RESULT':
          return afterSubscriptionResult(event.blocked);
        case 'SESSION_REVOKED':
          return 'session-ending';
        default:
          return status;
      }

    case 'session-ending':
      switch (event.type) {
        case 'SESSION_REVOKED':
          return 'session-ending';
        default:
          return status;
      }

    default:
      return status;
  }
}
