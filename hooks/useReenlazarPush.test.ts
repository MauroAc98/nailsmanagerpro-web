import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/services/pushService', () => ({
  pushService: {
    getPublicKey: vi.fn(),
    guardarSuscripcion: vi.fn(),
    borrarSuscripcion: vi.fn(),
  },
}));

import { pushService } from '@/services/pushService';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/services/authService';
import { useReenlazarPush } from './useReenlazarPush';

const svc = vi.mocked(pushService);

type OyenteMensaje = (e: { data: unknown }) => void;

// Oyentes de mensajes del service worker: el stub los captura para dispararlos.
let mensajes: OyenteMensaje[] = [];

function entorno(opts: { permiso: NotificationPermission; sub: unknown }) {
  const subscribe = vi.fn();
  const getSubscription = vi.fn().mockResolvedValue(opts.sub);
  const registro = { pushManager: { getSubscription, subscribe } };
  vi.stubGlobal('PushManager', function PushManager() {});
  (window as unknown as Record<string, unknown>).PushManager = (globalThis as Record<string, unknown>).PushManager;
  const Notif = { permission: opts.permiso, requestPermission: vi.fn() };
  vi.stubGlobal('Notification', Notif);
  (window as unknown as Record<string, unknown>).Notification = Notif;
  mensajes = [];
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: vi.fn().mockResolvedValue(registro),
      addEventListener: (t: string, fn: OyenteMensaje) => { if (t === 'message') mensajes.push(fn); },
      removeEventListener: (t: string, fn: OyenteMensaje) => { mensajes = mensajes.filter((m) => m !== fn); },
    },
    configurable: true,
  });
  return { subscribe, getSubscription, Notif };
}

const SUB = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }),
  unsubscribe: vi.fn(),
};

function sesion(authStatus: 'authenticated' | 'unauthenticated' | 'booting') {
  useAuthStore.setState({ authStatus, user: authStatus === 'authenticated' ? ({ id: 1 } as User) : null });
}

const microtareas = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  svc.guardarSuscripcion.mockResolvedValue();
  sesion('authenticated');
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('useReenlazarPush', () => {
  it('con permiso concedido y una suscripción existente la re-enlaza con el servidor', async () => {
    entorno({ permiso: 'granted', sub: SUB });
    renderHook(() => useReenlazarPush(true));
    await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1));
    expect(svc.guardarSuscripcion).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }),
    );
  });

  it('no hace nada si el permiso no está concedido', async () => {
    const { getSubscription } = entorno({ permiso: 'default', sub: SUB });
    renderHook(() => useReenlazarPush(true));
    await microtareas();
    expect(getSubscription).not.toHaveBeenCalled();
    expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
  });

  it('no hace nada si el permiso fue denegado', async () => {
    entorno({ permiso: 'denied', sub: SUB });
    renderHook(() => useReenlazarPush(true));
    await microtareas();
    expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
  });

  it('no hace nada sin suscripción (el usuario apagó el toggle a propósito)', async () => {
    const { getSubscription } = entorno({ permiso: 'granted', sub: null });
    renderHook(() => useReenlazarPush(true));
    await waitFor(() => expect(getSubscription).toHaveBeenCalled());
    await microtareas();
    expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
  });

  it('nunca pide permiso, ni se suscribe, ni da de baja la suscripción', async () => {
    const { subscribe, Notif } = entorno({ permiso: 'granted', sub: SUB });
    renderHook(() => useReenlazarPush(true));
    await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalled());
    expect(Notif.requestPermission).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(svc.getPublicKey).not.toHaveBeenCalled();
    expect(SUB.unsubscribe).not.toHaveBeenCalled();
  });

  it('no corre dos veces en el mismo arranque de sesión (re-render, cambio del usuario)', async () => {
    entorno({ permiso: 'granted', sub: SUB });
    const { rerender } = renderHook(() => useReenlazarPush(true));
    await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1));
    rerender();
    act(() => { useAuthStore.setState({ user: { id: 1, nombre: 'x' } as unknown as User }); });
    await microtareas();
    expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1);
  });

  it('corre de nuevo al iniciar otra sesión después de cerrar la anterior', async () => {
    entorno({ permiso: 'granted', sub: SUB });
    renderHook(() => useReenlazarPush(true));
    await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1));
    act(() => sesion('unauthenticated'));
    act(() => sesion('authenticated'));
    await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(2));
  });

  it('no corre sin sesión iniciada', async () => {
    sesion('unauthenticated');
    const { getSubscription } = entorno({ permiso: 'granted', sub: SUB });
    renderHook(() => useReenlazarPush(true));
    await microtareas();
    expect(getSubscription).not.toHaveBeenCalled();
    expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
  });

  it('no corre si está deshabilitado (panel de admin o reserva pública)', async () => {
    const { getSubscription } = entorno({ permiso: 'granted', sub: SUB });
    renderHook(() => useReenlazarPush(false));
    await microtareas();
    expect(getSubscription).not.toHaveBeenCalled();
    expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
    expect(mensajes).toHaveLength(0);
  });

  it('si el servidor falla no lanza ni muestra nada', async () => {
    entorno({ permiso: 'granted', sub: SUB });
    svc.guardarSuscripcion.mockRejectedValue(new Error('500'));
    renderHook(() => useReenlazarPush(true));
    await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalled());
    await microtareas();
  });

  it('si el navegador no tiene service worker no hace nada', async () => {
    entorno({ permiso: 'granted', sub: SUB });
    Reflect.deleteProperty(navigator, 'serviceWorker');
    renderHook(() => useReenlazarPush(true));
    await microtareas();
    expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
  });

  describe('push-subscription-changed (el service worker avisó de una rotación)', () => {
    it('con la app abierta re-enlaza enseguida, aunque ya lo hubiera hecho al arrancar', async () => {
      const { getSubscription } = entorno({ permiso: 'granted', sub: SUB });
      renderHook(() => useReenlazarPush(true));
      await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1));

      getSubscription.mockResolvedValue({ ...SUB, endpoint: 'https://push.example/nuevo' });
      act(() => { mensajes.forEach((m) => m({ data: { type: 'push-subscription-changed' } })); });
      await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(2));
      expect(svc.guardarSuscripcion).toHaveBeenLastCalledWith(
        expect.objectContaining({ endpoint: 'https://push.example/nuevo' }),
      );
    });

    it('ignora otros mensajes del service worker', async () => {
      entorno({ permiso: 'granted', sub: SUB });
      renderHook(() => useReenlazarPush(true));
      await waitFor(() => expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1));
      act(() => { mensajes.forEach((m) => m({ data: { type: 'otra-cosa' } })); });
      act(() => { mensajes.forEach((m) => m({ data: null })); });
      await microtareas();
      expect(svc.guardarSuscripcion).toHaveBeenCalledTimes(1);
    });

    it('deja de escuchar al desmontar', async () => {
      entorno({ permiso: 'granted', sub: SUB });
      const { unmount } = renderHook(() => useReenlazarPush(true));
      await waitFor(() => expect(mensajes).toHaveLength(1));
      unmount();
      expect(mensajes).toHaveLength(0);
    });

    it('si la sesión se cerró mientras se leía la suscripción, no manda nada al servidor', async () => {
      const { getSubscription } = entorno({ permiso: 'granted', sub: SUB });
      let soltar!: (v: unknown) => void;
      getSubscription.mockReturnValue(new Promise((r) => { soltar = r; }));
      renderHook(() => useReenlazarPush(true));
      await waitFor(() => expect(getSubscription).toHaveBeenCalled());
      act(() => sesion('unauthenticated'));
      await act(async () => { soltar(SUB); await Promise.resolve(); });
      expect(svc.guardarSuscripcion).not.toHaveBeenCalled();
    });
  });
});
