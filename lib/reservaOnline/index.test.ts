import { afterEach, describe, expect, it } from 'vitest';
import { componerServicio, ESCRITURAS_REALES, getService, LECTURAS_REALES, setServiceParaTests } from './index';
import { createMockService, memoriaStorage, MOCK_STORAGE_KEY } from './adapters/mock';
import type { ReservaOnlineWritesReales } from './adapters/realWrites';
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
      getDiasConDisponibilidad: async () => null,
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
      getDiasConDisponibilidad: async () => null,
    };
    const svc = componerServicio(mock, reales);
    expect((await svc.getSalon('demo')).nombre).toBe('Studio Demo');
    expect((await svc.getSalon('ana')).nombre).toBe('Real');
  });

  it('getDiasConDisponibilidad: demo la calcula el mock; un salon real responde lo que sepan las lecturas reales (null = no sabe)', async () => {
    const mock = createMockService({ storage: memoriaStorage() });
    const reales: ReservaOnlineReads = {
      getSalon: async () => ({ nombre: 'Real', logoUrl: null, direccion: null, profesionales: [] }),
      getServices: async () => [],
      getAvailability: async () => ({ fecha: '2026-09-25', duracionTotalMinutos: 0, slots: [] }),
      getDiasConDisponibilidad: async () => null,
    };
    const svc = componerServicio(mock, reales);
    const q = { fechas: ['2999-01-01'], servicioIds: [1] };
    expect(await svc.getDiasConDisponibilidad('demo', q)).toEqual(['2999-01-01']);
    expect(await svc.getDiasConDisponibilidad('ana', q)).toBeNull();
  });

  it('las escrituras reales estan activas (adapter de la slice 3 implementado)', () => {
    expect(ESCRITURAS_REALES).toBe(true);
  });

  it('con escrituras reales, un salon real las usa para las 5 escrituras y el resto sigue en mock', async () => {
    const mock = createMockService({ storage: memoriaStorage() });
    const llamadas: string[] = [];
    const escrituras: ReservaOnlineWritesReales = {
      retenerHorario: async () => {
        llamadas.push('retenerHorario');
        return { reservaId: 'real-1', expiresAtMs: 1, profesionalId: 3 };
      },
      actualizarDatosReserva: async () => void llamadas.push('actualizarDatosReserva'),
      iniciarPago: async () => {
        llamadas.push('iniciarPago');
        return { id: 'real-1', status: 'pending_payment', expiresAtMs: 1, checkoutUrl: 'x' };
      },
      liberarHold: async () => void llamadas.push('liberarHold'),
      getReservationStatus: async () => {
        llamadas.push('getReservationStatus');
        return {
          id: 'real-1',
          status: 'pending_payment',
          expiresAtMs: 1,
          summary: { servicioIds: [1], profesionalId: 3, fecha: '2026-09-25', hora: '10:00', deposito: 0, duracionTotalMinutos: 30 },
        };
      },
    };
    const svc = componerServicio(mock, undefined, escrituras);
    await svc.retenerHorario('ana', { servicioIds: [1], fecha: '2026-09-25', hora: '10:00' });
    await svc.actualizarDatosReserva('ana', 'real-1', { cliente: { nombre: 'A', apellido: 'B', whatsapp: '+5491155551234' } });
    await svc.iniciarPago('ana', 'real-1');
    await svc.liberarHold('ana', 'real-1');
    await svc.getReservationStatus('ana', 'real-1');
    expect(llamadas).toEqual(['retenerHorario', 'actualizarDatosReserva', 'iniciarPago', 'liberarHold', 'getReservationStatus']);
    // metodos mock-only: ajustes, Mercado Pago y listado siguen en el mock
    // (las fotos de servicio ya no viven aca, ver servicioService.ts)
    expect((await svc.getSettings()).habilitada).toBe(false);
    expect((await svc.getMpConnection()).conectada).toBe(false);
    expect(await svc.listOnlineBookings()).toEqual([]);
  });

  it('el slug demo sigue en mock aunque haya escrituras reales', async () => {
    const mock = createMockService({ storage: memoriaStorage() });
    const escrituras: ReservaOnlineWritesReales = {
      retenerHorario: async () => {
        throw new Error('el slug demo nunca deberia llegar a las escrituras reales');
      },
      actualizarDatosReserva: async () => {},
      iniciarPago: async () => {
        throw new Error('no llega');
      },
      liberarHold: async () => {},
      getReservationStatus: async () => {
        throw new Error('no llega');
      },
    };
    const svc = componerServicio(mock, undefined, escrituras);
    const h = await svc.retenerHorario('demo', { servicioIds: [1], profesionalId: 1, fecha: '2026-09-25', hora: '10:30' });
    expect(h.reservaId).toMatch(/^mock-/);
  });

  it('getService() compone las escrituras reales para salones reales', async () => {
    setServiceParaTests(null);
    localStorage.removeItem(MOCK_STORAGE_KEY);
    const svc = getService();
    // demo sigue funcionando con el mock (no pega al backend real)
    const h = await svc.retenerHorario('demo', { servicioIds: [1], profesionalId: 1, fecha: '2999-01-01', hora: '09:00' });
    expect(h.reservaId).toMatch(/^mock-/);
  });
});
