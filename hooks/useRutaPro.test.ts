import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { useRutaPro } from './useRutaPro';

describe('useRutaPro', () => {
  beforeEach(() => { nav.pathname = '/'; });

  it('en profesionales.turnetto.com (URLs limpias) deja la ruta tal cual', () => {
    nav.pathname = '/agenda';
    const { result } = renderHook(() => useRutaPro());
    expect(result.current('/cuenta')).toBe('/cuenta');
    expect(result.current('/')).toBe('/');
  });

  it('en localhost (portal bajo /pro) agrega el prefijo, incluido el home', () => {
    nav.pathname = '/pro/agenda';
    const { result } = renderHook(() => useRutaPro());
    expect(result.current('/cuenta')).toBe('/pro/cuenta');
    expect(result.current('/turnos/12?x=1')).toBe('/pro/turnos/12?x=1');
    expect(result.current('/')).toBe('/pro');
    expect(result.current('/login')).toBe('/pro/login');
  });
});
