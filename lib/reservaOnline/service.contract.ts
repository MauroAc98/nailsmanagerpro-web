import { describe, expect, it } from 'vitest';
import { ReservaOnlineError, type ReservaOnlineReads } from './service';

// Suite de contrato compartida (decision D5): cualquier adapter de lecturas
// (mock o real, este ultimo con HTTP stubbeado) debe cumplirla. Cada adapter la
// invoca desde su propio *.test.ts con una fabrica y un escenario conocido.
export interface ReadsScenario {
  slug: string; // salon existente
  slugInexistente: string;
  fechaFutura: string; // 'YYYY-MM-DD' con disponibilidad
  fechaPasada: string;
  servicioIds: number[]; // servicios reservables validos del salon
}

const HORA = /^\d{2}:\d{2}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function describeReadsContract(
  nombre: string,
  crear: () => ReservaOnlineReads,
  esc: ReadsScenario,
): void {
  describe(`contrato de lecturas: ${nombre}`, () => {
    it('getSalon devuelve la forma SalonInfo', async () => {
      const salon = await crear().getSalon(esc.slug);
      expect(typeof salon.nombre).toBe('string');
      expect(salon.logoUrl === null || typeof salon.logoUrl === 'string').toBe(true);
      expect(salon.direccion === null || typeof salon.direccion === 'string').toBe(true);
      expect(salon.profesionales.length).toBeGreaterThan(0);
      expect(typeof salon.pagoHabilitado).toBe('boolean');
      for (const p of salon.profesionales) {
        expect(typeof p.id).toBe('number');
        expect(typeof p.nombre).toBe('string');
      }
    });

    it('getSalon de un slug inexistente falla con not_found', async () => {
      await expect(crear().getSalon(esc.slugInexistente)).rejects.toMatchObject({
        name: ReservaOnlineError.name,
        code: 'not_found',
      });
    });

    it('getDiasConDisponibilidad devuelve null (no lo sabe) o un subconjunto de las fechas pedidas', async () => {
      const fechas = [esc.fechaFutura, esc.fechaPasada];
      const dias = await crear().getDiasConDisponibilidad(esc.slug, { fechas, servicioIds: esc.servicioIds });
      if (dias !== null) for (const d of dias) expect(fechas).toContain(d);
    });

    it('getServices devuelve servicios con la forma BookableService', async () => {
      const servicios = await crear().getServices(esc.slug);
      expect(servicios.length).toBeGreaterThan(0);
      for (const s of servicios) {
        expect(typeof s.id).toBe('number');
        expect(typeof s.nombre).toBe('string');
        expect(s.duracionMinutos).toBeGreaterThan(0);
        expect(typeof s.precio).toBe('number');
        expect(Array.isArray(s.fotos)).toBe(true);
      }
    });

    it('getAvailability devuelve fecha, duracion total y slots libres', async () => {
      const disp = await crear().getAvailability(esc.slug, {
        fecha: esc.fechaFutura,
        servicioIds: esc.servicioIds,
      });
      expect(disp.fecha).toBe(esc.fechaFutura);
      expect(disp.duracionTotalMinutos).toBeGreaterThan(0);
      expect(disp.slots.length).toBeGreaterThan(0);
      for (const slot of disp.slots) {
        expect(slot.hora).toMatch(HORA);
        expect(slot.profesionalIds.length).toBeGreaterThan(0);
      }
      const horas = disp.slots.map((s) => s.hora);
      expect(horas).toEqual([...horas].sort());
      expect(new Set(horas).size).toBe(horas.length);
      expect(disp.fecha).toMatch(FECHA);
    });

    it('getAvailability con fecha pasada falla con validation', async () => {
      await expect(
        crear().getAvailability(esc.slug, { fecha: esc.fechaPasada, servicioIds: esc.servicioIds }),
      ).rejects.toMatchObject({ code: 'validation' });
    });

    it('getAvailability sin servicios falla con validation', async () => {
      await expect(
        crear().getAvailability(esc.slug, { fecha: esc.fechaFutura, servicioIds: [] }),
      ).rejects.toMatchObject({ code: 'validation' });
    });
  });
}
