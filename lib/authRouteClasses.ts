// Route classifiers — design decision D2.
//
// `resolveAuthRoute` takes an injected `classify` so the same resolver serves
// both the tenant app and the admin panel with different route maps. These are
// pure: they only look at `loc.pathname`.

import type { RouteClass, RouteLocation } from './resolveAuthRoute';

// Matches an exact path or any nested path under it (`/login` also matches
// `/login/{slug}`), the same rule the legacy `esRutaPublica` used.
function matchesAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function classifyTenant(loc: RouteLocation): RouteClass {
  const { pathname } = loc;
  if (matchesAny(pathname, ['/legal'])) return 'neutral';
  if (matchesAny(pathname, ['/login', '/forgot-password', '/reset-password'])) return 'public';
  if (matchesAny(pathname, ['/cambiar-password'])) return 'change-pw';
  if (matchesAny(pathname, ['/subscription-expired'])) return 'blocked';
  return 'protected';
}

export function classifyAdmin(loc: RouteLocation): RouteClass {
  return matchesAny(loc.pathname, ['/login']) ? 'public' : 'protected';
}
