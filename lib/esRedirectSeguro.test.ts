import { describe, expect, it } from 'vitest';
import { esRedirectSeguro } from './esRedirectSeguro';

// Extracted verbatim from `app/providers.tsx` (design D2). A `redirect` query
// param is URL-controlled: it must resolve to an internal path, never an
// external origin, or it becomes an open-redirect.

describe('esRedirectSeguro', () => {
  it('accepts a plain internal path', () => {
    expect(esRedirectSeguro('/agenda')).toBe(true);
  });

  it('accepts an internal path with query string', () => {
    expect(esRedirectSeguro('/clientes/123?tab=historia')).toBe(true);
  });

  it('accepts an internal path with a fragment', () => {
    expect(esRedirectSeguro('/agenda#hoy')).toBe(true);
  });

  it('rejects null', () => {
    expect(esRedirectSeguro(null)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(esRedirectSeguro('')).toBe(false);
  });

  it('rejects an absolute http URL', () => {
    expect(esRedirectSeguro('http://evil.com/steal')).toBe(false);
  });

  it('rejects an absolute https URL', () => {
    expect(esRedirectSeguro('https://evil.com')).toBe(false);
  });

  it('rejects a protocol-relative URL', () => {
    expect(esRedirectSeguro('//evil.com')).toBe(false);
  });

  it('rejects a backslash-prefixed URL that the WHATWG parser normalizes to a host', () => {
    expect(esRedirectSeguro('/\\evil.com')).toBe(false);
  });

  it('rejects a URL that carries an explicit host', () => {
    expect(esRedirectSeguro('http://localhost@evil.com')).toBe(false);
  });
});
