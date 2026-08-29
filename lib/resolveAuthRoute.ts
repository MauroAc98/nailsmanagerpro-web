// Pure auth route resolver — design decision D2.
//
// One function decides `allow | redirect | blank` for every consumer. The
// redirect effect AND the render gate in `app/providers.tsx`, plus
// `app/(admin)/admin/layout.tsx`, derive their decision from this function
// only — no routing branch is duplicated.
//
// PURE: no imports from react / next / window. `classify` is INJECTED so the
// same function serves both consumers with different route maps.

import { esRedirectSeguro } from './esRedirectSeguro';
import type { AuthStatus } from './authMachine';

export type { AuthStatus };

export interface AuthRouteSnapshot {
  status: AuthStatus;
  i18nReady: boolean;
}

// `search` widened from a bare pathname: origin preservation (rider #14) needs
// the query string. When non-empty it is expected to include the leading `?`.
export type RouteLocation = { pathname: string; search: string };

export type RouteClass = 'public' | 'neutral' | 'change-pw' | 'blocked' | 'protected';

export type AuthRoute = { type: 'allow' } | { type: 'redirect'; to: string } | { type: 'blank' };

// Per-consumer options. `home` is where an authenticated user is sent when
// they land on a route they no longer belong on (a public/change-pw/blocked
// route). The tenant app defaults to `/agenda`; the admin panel injects `/`
// because it has no `/agenda` route (task 5.3 — reconciles the D2 deviation
// flagged in Slice 2).
export interface ResolveAuthRouteOptions {
  home?: string;
}

const ALLOW: AuthRoute = { type: 'allow' };
const BLANK: AuthRoute = { type: 'blank' };
const redirect = (to: string): AuthRoute => ({ type: 'redirect', to });

const DEFAULT_HOME = '/agenda';
const CHANGE_PW = '/cambiar-password';
const BLOCKED = '/subscription-expired';

// `<origin>` = esRedirectSeguro(pathname+search) ? encodeURIComponent(...) : ''
function buildOrigin(loc: RouteLocation): string {
  const full = loc.pathname + loc.search;
  return esRedirectSeguro(full) ? encodeURIComponent(full) : '';
}

function loginWithOrigin(loc: RouteLocation): string {
  const origin = buildOrigin(loc);
  return origin ? `/login?redirect=${origin}` : '/login';
}

// Authenticated user landing on a public route: honor a safe `?redirect=`
// target if present, otherwise go home. Mirrors the legacy providers logic.
function postLoginTarget(loc: RouteLocation, home: string): string {
  const query = loc.search.startsWith('?') ? loc.search.slice(1) : loc.search;
  const requested = new URLSearchParams(query).get('redirect');
  return esRedirectSeguro(requested) ? requested : home;
}

export function resolveAuthRoute(
  s: AuthRouteSnapshot,
  loc: RouteLocation,
  classify: (loc: RouteLocation) => RouteClass,
  opts?: ResolveAuthRouteOptions,
): AuthRoute {
  const routeClass = classify(loc);
  const home = opts?.home ?? DEFAULT_HOME;

  // Precedence 1: neutral routes are always allowed, even while booting.
  if (routeClass === 'neutral') return ALLOW;

  // Precedence 2: nothing renders until the app has booted and i18n is ready.
  if (s.status === 'booting' || !s.i18nReady) return BLANK;

  // Precedence 3: the status x routeClass decision table.
  switch (s.status) {
    case 'unauthenticated':
      switch (routeClass) {
        case 'public':
          return ALLOW;
        case 'change-pw':
          return redirect('/login');
        case 'blocked':
        case 'protected':
          return redirect(loginWithOrigin(loc));
        default:
          return BLANK;
      }

    case 'must-change-password':
      return routeClass === 'change-pw' ? ALLOW : redirect(CHANGE_PW);

    case 'subscription-blocked':
      return routeClass === 'blocked' ? ALLOW : redirect(BLOCKED);

    case 'authenticated':
      switch (routeClass) {
        case 'protected':
          return ALLOW;
        case 'public':
          return redirect(postLoginTarget(loc, home));
        case 'change-pw':
        case 'blocked':
          return redirect(home);
        default:
          return BLANK;
      }

    case 'session-ending':
      // The modal owns the screen; the last route stays mounted underneath.
      return ALLOW;

    default:
      return BLANK;
  }
}
