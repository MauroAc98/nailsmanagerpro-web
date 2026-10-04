import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/services/pushService', () => ({
  pushService: {
    getPublicKey: vi.fn(),
    guardarSuscripcion: vi.fn(),
    borrarSuscripcion: vi.fn(),
  },
}));

import { pushService } from '@/services/pushService';
import { useAvisosReservas } from './useAvisosReservas';

const svc = vi.mocked(pushService);

function entorno(opts: { permiso: NotificationPermission; sub: unknown; requestResult?: NotificationPermission }) {
  const subscribe = vi.fn().mockResolvedValue({
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  });
  const registro = { pushManager: { getSubscription: vi.fn().mockResolvedValue(opts.sub), subscribe } };
  vi.stubGlobal('PushManager', function PushManager() {});
  (window as unknown as Record<string, unknown>).PushManager = (globalThis as Record<string, unknown>).PushManager;
  const Notif = { permission: opts.permiso, requestPermission: vi.fn().mockResolvedValue(opts.requestResult ?? 'granted') };
  vi.stubGlobal('Notification', Notif);
  (window as unknown as Record<string, unknown>).Notification = Notif;
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(registro) }, configurable: true });
  return { subscribe, Notif };
}

describe('useAvisosReservas', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('arranca en off cuando hay soporte y no hay suscripción', async () => {
    entorno({ permiso: 'default', sub: null });
    const { result } = renderHook(() => useAvisosReservas());
    await waitFor(() => expect(result.current.estado).toBe('off'));
  });

  it('activar: pide permiso, trae la clave, se suscribe y registra en el servidor', async () => {
    const { subscribe } = entorno({ permiso: 'default', sub: null });
    svc.getPublicKey.mockResolvedValue('aGVsbG8_Pg');
    svc.guardarSuscripcion.mockResolvedValue();
    const { result } = renderHook(() => useAvisosReservas());
    await waitFor(() => expect(result.current.estado).toBe('off'));
    await act(async () => { await result.current.activar(); });
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(svc.guardarSuscripcion).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/abc', keys: { p256dh: 'P', auth: 'A' } }),
    );
    expect(result.current.error).toBeNull();
  });

  it('activar con 503 informa "unavailable"', async () => {
    entorno({ permiso: 'default', sub: null });
    svc.getPublicKey.mockRejectedValue({ response: { status: 503 } });
    const { result } = renderHook(() => useAvisosReservas());
    await waitFor(() => expect(result.current.estado).toBe('off'));
    await act(async () => { await result.current.activar(); });
    expect(result.current.error).toBe('unavailable');
  });

  it('desactivar borra en el servidor y desuscribe localmente', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    entorno({ permiso: 'granted', sub: { endpoint: 'https://push.example/abc', unsubscribe } });
    svc.borrarSuscripcion.mockResolvedValue();
    const { result } = renderHook(() => useAvisosReservas());
    await waitFor(() => expect(result.current.estado).toBe('on'));
    await act(async () => { await result.current.desactivar(); });
    expect(svc.borrarSuscripcion).toHaveBeenCalledWith('https://push.example/abc');
    expect(unsubscribe).toHaveBeenCalled();
  });
});
