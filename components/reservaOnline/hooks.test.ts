import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import { useIr } from './hooks';

const ORIGINAL_LOCATION = window.location;

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...ORIGINAL_LOCATION, hostname },
    configurable: true,
  });
}

beforeEach(() => {
  resetNavigationMock();
  setHostname(ORIGINAL_LOCATION.hostname);
});

afterEach(() => {
  Object.defineProperty(window, 'location', { value: ORIGINAL_LOCATION, configurable: true });
});

// Bug real de prod: dentro de reservar.turnetto.com, empujar la ruta absoluta
// /reservar/{slug}/... duplica el prefijo (el rewrite server-side lo vuelve a
// agregar) y termina en 404 al tocar cualquier botón "Continuar". `useIr` es
// el único punto de navegación del flujo — el fix vive acá, no en cada pantalla.
describe('useIr', () => {
  it('en reservar.turnetto.com saca el prefijo /reservar antes de navegar', () => {
    setHostname('reservar.turnetto.com');
    const { result } = renderHook(() => useIr());

    result.current('/reservar/natalia-acosta/servicios');

    expect(routerMock.push).toHaveBeenCalledWith('/natalia-acosta/servicios');
  });

  it('en app.turnetto.com navega con la ruta tal cual', () => {
    setHostname('app.turnetto.com');
    const { result } = renderHook(() => useIr());

    result.current('/reservar/natalia-acosta/servicios');

    expect(routerMock.push).toHaveBeenCalledWith('/reservar/natalia-acosta/servicios');
  });
});
