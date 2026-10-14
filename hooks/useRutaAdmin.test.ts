import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { useRutaAdmin } from './useRutaAdmin';

describe('useRutaAdmin', () => {
  beforeEach(() => { nav.pathname = '/'; });

  it('en admin.turnetto.com (URLs limpias) deja la ruta tal cual', () => {
    nav.pathname = '/suscripciones';
    const { result } = renderHook(() => useRutaAdmin());
    expect(result.current('/uso')).toBe('/uso');
    expect(result.current('/')).toBe('/');
  });

  it('en localhost (panel bajo /admin) agrega el prefijo, incluido el home', () => {
    nav.pathname = '/admin';
    const { result } = renderHook(() => useRutaAdmin());
    expect(result.current('/uso')).toBe('/admin/uso');
    expect(result.current('/uso/12?fecha=2026-10-01')).toBe('/admin/uso/12?fecha=2026-10-01');
    expect(result.current('/')).toBe('/admin');
    expect(result.current('/login')).toBe('/admin/login');
  });
});
