import { describe, expect, it } from 'vitest';
import { securityHeaders } from './securityHeaders';

const valorDe = (clave: string): string | undefined =>
  securityHeaders.find((h) => h.key.toLowerCase() === clave.toLowerCase())?.value;

describe('securityHeaders', () => {
  it('impide que la app se muestre dentro de un iframe (clickjacking, sobre todo en /admin)', () => {
    expect(valorDe('X-Frame-Options')).toBe('DENY');
    expect(valorDe('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('el CSP es acotado: no exige script-src/default-src (romperia el script inline del tema y los SDK)', () => {
    const csp = valorDe('Content-Security-Policy') ?? '';
    expect(csp).not.toMatch(/script-src|default-src/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('fuerza HTTPS con HSTS de 1 año, sin includeSubDomains ni preload', () => {
    expect(valorDe('Strict-Transport-Security')).toBe('max-age=31536000');
  });

  it('evita el sniffing de tipos y limita el referrer', () => {
    expect(valorDe('X-Content-Type-Options')).toBe('nosniff');
    expect(valorDe('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});
