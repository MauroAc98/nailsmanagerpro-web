import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import { useRefrescoEstadoNegocio } from './useRefrescoEstadoNegocio';

// El admin cambia la reserva online desde otro navegador: la app abierta debe
// enterarse sola, al volver a ella y cada tanto mientras se la mira.
const refrescar = vi.fn(() => Promise.resolve());

function setVisibilidad(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
  refrescar.mockClear();
  setVisibilidad('visible');
  useAuthStore.setState({
    user: { id: 1 } as User,
    authStatus: 'authenticated',
    refrescarEstadoNegocio: refrescar,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRefrescoEstadoNegocio', () => {
  it('al volver a la pestaña (después de un rato) refresca el estado del negocio', () => {
    renderHook(() => useRefrescoEstadoNegocio());
    vi.advanceTimersByTime(20_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('al recuperar el foco de la ventana también refresca', () => {
    renderHook(() => useRefrescoEstadoNegocio());
    vi.advanceTimersByTime(20_000);
    window.dispatchEvent(new Event('focus'));
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('no refresca de nuevo si pasaron menos de 15 segundos', () => {
    renderHook(() => useRefrescoEstadoNegocio());
    vi.advanceTimersByTime(20_000);
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(5_000);
    window.dispatchEvent(new Event('focus'));
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('con la app abierta y visible refresca solo cada 60 segundos', () => {
    renderHook(() => useRefrescoEstadoNegocio());
    vi.advanceTimersByTime(60_000);
    expect(refrescar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(refrescar).toHaveBeenCalledTimes(2);
  });

  it('no refresca mientras la pestaña está oculta', () => {
    renderHook(() => useRefrescoEstadoNegocio());
    setVisibilidad('hidden');
    vi.advanceTimersByTime(120_000);
    window.dispatchEvent(new Event('focus'));
    expect(refrescar).not.toHaveBeenCalled();
  });

  it('sin sesión iniciada no hace nada', () => {
    useAuthStore.setState({ user: null, authStatus: 'unauthenticated' });
    renderHook(() => useRefrescoEstadoNegocio());
    vi.advanceTimersByTime(120_000);
    window.dispatchEvent(new Event('focus'));
    expect(refrescar).not.toHaveBeenCalled();
  });

  it('al desmontarse deja de escuchar y de refrescar', () => {
    const { unmount } = renderHook(() => useRefrescoEstadoNegocio());
    unmount();
    vi.advanceTimersByTime(120_000);
    window.dispatchEvent(new Event('focus'));
    expect(refrescar).not.toHaveBeenCalled();
  });
});
