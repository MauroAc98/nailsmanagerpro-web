import { describe, it, expect, vi, afterEach } from 'vitest';
import { leerSuscripcionExistente, payloadDeSuscripcion } from './suscripcionPush';

function conServiceWorker(sw: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('leerSuscripcionExistente', () => {
  it('devuelve la suscripción del registro actual sin esperar a `ready`', async () => {
    const sub = { endpoint: 'https://push.example/a' };
    const getRegistration = vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) } });
    conServiceWorker({ getRegistration, get ready() { throw new Error('no debe usar ready'); } });
    await expect(leerSuscripcionExistente()).resolves.toBe(sub);
  });

  it('devuelve null sin registro, sin suscripción o sin service worker', async () => {
    conServiceWorker({ getRegistration: vi.fn().mockResolvedValue(undefined) });
    await expect(leerSuscripcionExistente()).resolves.toBeNull();
    conServiceWorker({ getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }) });
    await expect(leerSuscripcionExistente()).resolves.toBeNull();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    await expect(leerSuscripcionExistente()).resolves.toBeNull();
  });

  it('devuelve null si el navegador lanza', async () => {
    conServiceWorker({ getRegistration: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(leerSuscripcionExistente()).resolves.toBeNull();
  });

  it('se rinde con null si el navegador no responde dentro del límite', async () => {
    vi.useFakeTimers();
    conServiceWorker({ getRegistration: vi.fn().mockReturnValue(new Promise(() => {})) });
    const p = leerSuscripcionExistente(500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeNull();
  });
});

describe('payloadDeSuscripcion', () => {
  it('arma endpoint, claves y user agent', () => {
    const sub = { endpoint: 'https://push.example/a', toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }) };
    const p = payloadDeSuscripcion(sub as unknown as PushSubscription);
    expect(p).toMatchObject({ endpoint: 'https://push.example/a', keys: { p256dh: 'P', auth: 'A' } });
    expect(typeof p.user_agent).toBe('string');
  });

  it('tolera claves ausentes', () => {
    const sub = { endpoint: 'e', toJSON: () => ({}) };
    expect(payloadDeSuscripcion(sub as unknown as PushSubscription).keys).toEqual({ p256dh: '', auth: '' });
  });
});
