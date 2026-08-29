import { describe, expect, it } from 'vitest';
import {
  resolveAuthRoute,
  type AuthRoute,
  type AuthRouteSnapshot,
  type RouteClass,
  type RouteLocation,
} from './resolveAuthRoute';
import { classifyAdmin, classifyTenant } from './authRouteClasses';

// Fixed classifier that ignores the location and always reports one class —
// lets us drive the full status x routeClass matrix without route strings.
const always = (c: RouteClass) => (): RouteClass => c;

const ready = (status: AuthRouteSnapshot['status']): AuthRouteSnapshot => ({
  status,
  i18nReady: true,
});

const loc = (pathname: string, search = ''): RouteLocation => ({ pathname, search });

const redirect = (to: string): AuthRoute => ({ type: 'redirect', to });
const allow: AuthRoute = { type: 'allow' };
const blank: AuthRoute = { type: 'blank' };

describe('resolveAuthRoute — precedence', () => {
  it('neutral class -> allow regardless of status', () => {
    expect(resolveAuthRoute(ready('unauthenticated'), loc('/legal'), always('neutral'))).toEqual(
      allow,
    );
    expect(resolveAuthRoute(ready('subscription-blocked'), loc('/legal'), always('neutral'))).toEqual(
      allow,
    );
  });

  it('neutral -> allow even while booting and i18n not ready', () => {
    const snap: AuthRouteSnapshot = { status: 'booting', i18nReady: false };
    expect(resolveAuthRoute(snap, loc('/legal'), always('neutral'))).toEqual(allow);
  });

  it('booting -> blank on a protected route', () => {
    expect(resolveAuthRoute(ready('booting'), loc('/agenda'), always('protected'))).toEqual(blank);
  });

  it('booting -> blank on a public route', () => {
    expect(resolveAuthRoute(ready('booting'), loc('/login'), always('public'))).toEqual(blank);
  });

  it('!i18nReady -> blank even when authenticated on a protected route', () => {
    const snap: AuthRouteSnapshot = { status: 'authenticated', i18nReady: false };
    expect(resolveAuthRoute(snap, loc('/agenda'), always('protected'))).toEqual(blank);
  });

  it('neutral precedence beats the !i18nReady blank', () => {
    const snap: AuthRouteSnapshot = { status: 'authenticated', i18nReady: false };
    expect(resolveAuthRoute(snap, loc('/legal'), always('neutral'))).toEqual(allow);
  });
});

describe('resolveAuthRoute — status x routeClass matrix', () => {
  it('unauthenticated', () => {
    expect(resolveAuthRoute(ready('unauthenticated'), loc('/login'), always('public'))).toEqual(
      allow,
    );
    expect(
      resolveAuthRoute(ready('unauthenticated'), loc('/cambiar-password'), always('change-pw')),
    ).toEqual(redirect('/login'));
    expect(
      resolveAuthRoute(ready('unauthenticated'), loc('/subscription-expired'), always('blocked')),
    ).toEqual(redirect(`/login?redirect=${encodeURIComponent('/subscription-expired')}`));
    expect(resolveAuthRoute(ready('unauthenticated'), loc('/agenda'), always('protected'))).toEqual(
      redirect(`/login?redirect=${encodeURIComponent('/agenda')}`),
    );
  });

  it('must-change-password', () => {
    expect(
      resolveAuthRoute(ready('must-change-password'), loc('/login'), always('public')),
    ).toEqual(redirect('/cambiar-password'));
    expect(
      resolveAuthRoute(ready('must-change-password'), loc('/cambiar-password'), always('change-pw')),
    ).toEqual(allow);
    expect(
      resolveAuthRoute(ready('must-change-password'), loc('/subscription-expired'), always('blocked')),
    ).toEqual(redirect('/cambiar-password'));
    expect(
      resolveAuthRoute(ready('must-change-password'), loc('/agenda'), always('protected')),
    ).toEqual(redirect('/cambiar-password'));
  });

  it('subscription-blocked', () => {
    expect(
      resolveAuthRoute(ready('subscription-blocked'), loc('/login'), always('public')),
    ).toEqual(redirect('/subscription-expired'));
    expect(
      resolveAuthRoute(ready('subscription-blocked'), loc('/cambiar-password'), always('change-pw')),
    ).toEqual(redirect('/subscription-expired'));
    expect(
      resolveAuthRoute(ready('subscription-blocked'), loc('/subscription-expired'), always('blocked')),
    ).toEqual(allow);
    expect(
      resolveAuthRoute(ready('subscription-blocked'), loc('/agenda'), always('protected')),
    ).toEqual(redirect('/subscription-expired'));
  });

  it('authenticated', () => {
    expect(resolveAuthRoute(ready('authenticated'), loc('/login'), always('public'))).toEqual(
      redirect('/agenda'),
    );
    expect(
      resolveAuthRoute(ready('authenticated'), loc('/cambiar-password'), always('change-pw')),
    ).toEqual(redirect('/agenda'));
    expect(
      resolveAuthRoute(ready('authenticated'), loc('/subscription-expired'), always('blocked')),
    ).toEqual(redirect('/agenda'));
    expect(resolveAuthRoute(ready('authenticated'), loc('/agenda'), always('protected'))).toEqual(
      allow,
    );
  });

  it('authenticated on a public route follows a safe ?redirect= param', () => {
    expect(
      resolveAuthRoute(
        ready('authenticated'),
        loc('/login', `?redirect=${encodeURIComponent('/clientes/5?tab=historia')}`),
        always('public'),
      ),
    ).toEqual(redirect('/clientes/5?tab=historia'));
  });

  it('authenticated on a public route drops an unsafe ?redirect= param', () => {
    expect(
      resolveAuthRoute(
        ready('authenticated'),
        loc('/login', '?redirect=https://evil.com'),
        always('public'),
      ),
    ).toEqual(redirect('/agenda'));
  });

  it('session-ending -> allow on every routeClass', () => {
    for (const c of ['public', 'change-pw', 'blocked', 'protected', 'neutral'] as RouteClass[]) {
      expect(resolveAuthRoute(ready('session-ending'), loc('/agenda'), always(c))).toEqual(allow);
    }
  });
});

describe('resolveAuthRoute — origin preservation', () => {
  it('redirect origin carries the query string', () => {
    const result = resolveAuthRoute(
      ready('unauthenticated'),
      loc('/clientes/123', '?tab=historia'),
      always('protected'),
    );
    expect(result).toEqual(
      redirect(`/login?redirect=${encodeURIComponent('/clientes/123?tab=historia')}`),
    );
  });

  it('unsafe origin like //evil.com is dropped (no ?redirect=)', () => {
    const result = resolveAuthRoute(
      ready('unauthenticated'),
      loc('//evil.com', ''),
      always('protected'),
    );
    expect(result).toEqual(redirect('/login'));
  });
});

describe('resolveAuthRoute — home override (task 5.3, admin consumer)', () => {
  it('authenticated on a public route with no ?redirect= uses the injected home', () => {
    expect(
      resolveAuthRoute(ready('authenticated'), loc('/login'), always('public'), { home: '/' }),
    ).toEqual(redirect('/'));
  });

  it('authenticated on change-pw / blocked classes uses the injected home', () => {
    expect(
      resolveAuthRoute(ready('authenticated'), loc('/cambiar-password'), always('change-pw'), {
        home: '/',
      }),
    ).toEqual(redirect('/'));
    expect(
      resolveAuthRoute(ready('authenticated'), loc('/subscription-expired'), always('blocked'), {
        home: '/',
      }),
    ).toEqual(redirect('/'));
  });

  it('defaults home to /agenda when no override is passed (tenant consumer unchanged)', () => {
    expect(resolveAuthRoute(ready('authenticated'), loc('/login'), always('public'))).toEqual(
      redirect('/agenda'),
    );
  });

  it('a safe ?redirect= param still wins over the injected home', () => {
    expect(
      resolveAuthRoute(
        ready('authenticated'),
        loc('/login', `?redirect=${encodeURIComponent('/suscripciones')}`),
        always('public'),
        { home: '/' },
      ),
    ).toEqual(redirect('/suscripciones'));
  });

  it('classifyAdmin: authenticated on /login with { home: "/" } -> redirect /', () => {
    expect(
      resolveAuthRoute(ready('authenticated'), loc('/login'), classifyAdmin, { home: '/' }),
    ).toEqual(redirect('/'));
  });
});

describe('resolveAuthRoute — with real classifiers', () => {
  it('classifyTenant: unauthenticated on /agenda -> redirect to /login with origin', () => {
    expect(
      resolveAuthRoute(ready('unauthenticated'), loc('/agenda'), classifyTenant),
    ).toEqual(redirect(`/login?redirect=${encodeURIComponent('/agenda')}`));
  });

  it('classifyTenant: unauthenticated on /login -> allow', () => {
    expect(resolveAuthRoute(ready('unauthenticated'), loc('/login'), classifyTenant)).toEqual(allow);
  });

  it('classifyTenant: authenticated on /legal -> allow (neutral)', () => {
    expect(resolveAuthRoute(ready('authenticated'), loc('/legal/terminos'), classifyTenant)).toEqual(
      allow,
    );
  });

  it('classifyAdmin: unauthenticated on /suscripciones -> redirect to /login with origin', () => {
    expect(
      resolveAuthRoute(ready('unauthenticated'), loc('/suscripciones'), classifyAdmin),
    ).toEqual(redirect(`/login?redirect=${encodeURIComponent('/suscripciones')}`));
  });

  it('classifyAdmin: authenticated on /login -> redirect /agenda', () => {
    expect(resolveAuthRoute(ready('authenticated'), loc('/login'), classifyAdmin)).toEqual(
      redirect('/agenda'),
    );
  });
});
