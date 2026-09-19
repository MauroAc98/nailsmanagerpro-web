import { afterEach, describe, expect, it } from 'vitest';
import { componerServicio, getService, LECTURAS_REALES, setServiceParaTests } from './index';
import { createMockService, memoriaStorage } from './adapters/mock';
import type { ReservaOnlineReads } from './service';

describe('composicion del servicio', () => {
  afterEach(() => setServiceParaTests(null));

  it('sin lecturas reales, todo sale del mock', async () => {
    const mock = createMockService({ storage: memoriaStorage() });
    const svc = componerServicio(mock);
    expect((await svc.getSalon('demo')).nombre).toBe('Studio Demo');
  });

  it('con lecturas reales, getSalon/getServices/getAvailability las usan y el resto sigue en mock', async () => {
    const mock = createMockService({ storage: memoriaStorage() });
    const reales: ReservaOnlineReads = {
      getSalon: async () => ({ nombre: 'Real', logoUrl: null, direccion: null, profesionales: [] }),
      getServices: async () => [],
      getAvailability: async () => ({ fecha: '2026-09-25', duracionTotalMinutos: 0, slots: [] }),
    };
    const svc = componerServicio(mock, reales);
    expect((await svc.getSalon('ana')).nombre).toBe('Real');
    expect((await svc.getSettings()).habilitada).toBe(false); // mock
  });

  it('getService() devuelve el servicio inyectado por el seam de tests', () => {
    const mock = createMockService({ storage: memoriaStorage() });
    setServiceParaTests(mock);
    expect(getService()).toBe(mock);
  });

  it('las lecturas reales estan activas (adapter 2.8 implementado)', () => {
    expect(LECTURAS_REALES).toBe(true);
  });

  it('el slug demo sigue en mock y cualquier otro va a las lecturas reales', async () => {
    const mock = createMockService({ storage: memoriaStorage() });
    const reales: ReservaOnlineReads = {
      getSalon: async () => ({ nombre: 'Real', logoUrl: null, direccion: null, profesionales: [] }),
      getServices: async () => [],
      getAvailability: async () => ({ fecha: '2026-09-25', duracionTotalMinutos: 0, slots: [] }),
    };
    const svc = componerServicio(mock, reales);
    expect((await svc.getSalon('demo')).nombre).toBe('Studio Demo');
    expect((await svc.getSalon('ana')).nombre).toBe('Real');
  });
});
