import { describe, expect, it } from 'vitest';
import type { ReservaOnlineReads } from '../service';
import { createMockService, memoriaStorage } from './mock';
import { crearPendiente } from './mockTestHelpers';

const AHORA = Date.UTC(2026, 8, 19, 15, 0);

// Lecturas "reales" falsas: el mock de escrituras debe apoyarse en ellas para
// salones que no son `demo` (composicion: lecturas reales + escrituras mock).
const lecturas: ReservaOnlineReads = {
  getSalon: async () => ({ nombre: 'Studio Ana', logoUrl: null, direccion: null, profesionales: [{ id: 3, nombre: 'Ana', avatarUrl: null }], pagoHabilitado: true }),
  getServices: async () => [{ id: 7, nombre: 'Esmaltado', duracionMinutos: 45, precio: 12000, fotos: [] }],
  getDiasConDisponibilidad: async () => null,
  getAvailability: async (_s, q) => ({
    fecha: q.fecha,
    duracionTotalMinutos: 45,
    slots: [{ hora: '10:00', profesionalIds: [3] }],
  }),
};

const nuevo = (l?: ReservaOnlineReads) =>
  createMockService({ now: () => AHORA, storage: memoriaStorage(), lecturas: l });

const input = {
  servicioIds: [7],
  profesionalId: 3,
  fecha: '2026-09-25',
  hora: '10:00',
  cliente: { nombre: 'Lu', apellido: 'Paz', whatsapp: '+5491155551234' },
};

describe('mock con salon real (lecturas inyectadas)', () => {
  it('getTerms responde para un slug que no es demo', async () => {
    expect((await nuevo(lecturas).getTerms('ana')).deposito).toBeGreaterThan(0);
  });

  it('crea la reserva calculando la duracion con los servicios reales', async () => {
    const svc = nuevo(lecturas);
    const r = await crearPendiente(svc, 'ana', input);
    const est = await svc.getReservationStatus('ana', r.id);
    expect(est.summary.duracionTotalMinutos).toBe(45);
  });

  it('un horario que ya no esta libre falla con slot_taken', async () => {
    await expect(crearPendiente(nuevo(lecturas), 'ana', { ...input, hora: '11:00' })).rejects.toMatchObject({
      code: 'slot_taken',
    });
  });

  it('sin lecturas inyectadas un slug desconocido sigue siendo not_found', async () => {
    await expect(nuevo().getTerms('ana')).rejects.toMatchObject({ code: 'not_found' });
  });
});
