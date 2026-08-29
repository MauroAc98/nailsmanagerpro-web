// `redirect` is a URL-controlled query param — never trust it blindly or it
// becomes an open redirect. Enumerating dangerous prefixes by hand
// (protocol-relative "//evil.com", etc.) is not enough: "/\evil.com"
// (backslash) passes any string check, but the WHATWG URL parser that Next's
// router uses internally normalizes it exactly like "//evil.com" and resolves
// it to a real external origin. Instead of chasing variants, delegate the
// normalization to the same parser that exploits them: if resolving `path`
// against a fixed arbitrary origin changes the origin, it is an external URL
// (protocol-relative, with host, or with backslash), not an internal path.
//
// Extracted from `app/providers.tsx` (design D2); still re-exported there for
// back-compat.
export function esRedirectSeguro(path: string | null): path is string {
  if (!path) return false;
  try {
    const base = 'http://localhost';
    return new URL(path, base).origin === base;
  } catch {
    return false;
  }
}
