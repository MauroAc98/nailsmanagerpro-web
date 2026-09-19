import { describe, expect, it } from 'vitest';
import { describeReadsContract } from '../service.contract';
import { createMockService, memoriaStorage } from './mock';
import { crearPendiente } from './mockTestHelpers';

// 2026-09-19 12:00 hora del salon (UTC-3).
export const AHORA = Date.UTC(2026, 8, 19, 15, 0);

const nuevo = (now = () => AHORA) => createMockService({ now, storage: memoriaStorage() });

describeReadsContract('mock', () => nuevo(), {
  slug: 'demo',
  slugInexistente: 'no-existe',
  fechaFutura: '2026-09-25',
  fechaPasada: '2026-09-18',
  servicioIds: [1, 2],
});

describe('mock: lecturas', () => {
  it('hoy respeta la anticipacion minima (120 min): a las 12:00 el primer slot es 14:00', async () => {
    const disp = await nuevo().getAvailability('demo', { fecha: '2026-09-19', servicioIds: [1] });
    expect(disp.slots[0].hora).toBe('14:00');
  });

  it('getServices filtrado por profesional solo trae los que ofrece', async () => {
    const todos = await nuevo().getServices('demo');
    const deLaSegunda = await nuevo().getServices('demo', { profesionalId: 2 });
    expect(deLaSegunda.length).toBeLessThan(todos.length);
  });

  it('con profesional especifico, cada slot lista solo a ese profesional', async () => {
    const disp = await nuevo().getAvailability('demo', {
      fecha: '2026-09-25',
      servicioIds: [1],
      profesionalId: 1,
    });
    expect(disp.slots.every((s) => s.profesionalIds.length === 1 && s.profesionalIds[0] === 1)).toBe(
      true,
    );
  });

  it('la duracion total suma los servicios (45 + 30 = 75)', async () => {
    const disp = await nuevo().getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1, 2] });
    expect(disp.duracionTotalMinutos).toBe(75);
  });

  it('los horarios son una grilla de inicios de 09:00 a 18:00 cada 30 min (rango, no lista) menos lo ocupado del demo', async () => {
    const disp = await nuevo().getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1, 2] });
    const horas = disp.slots.map((s) => s.hora);
    expect(horas[0]).toBe('09:00');
    expect(horas[horas.length - 1]).toBe('18:00'); // el ultimo inicio no depende de la duracion
    expect(horas.every((h) => h.endsWith(':00') || h.endsWith(':30'))).toBe(true);
    // 19 inicios de grilla menos 14:30, 15:00 y 15:30 (ambas profesionales ocupadas)
    expect(horas).toHaveLength(16);
  });

  it('el demo trae intervalos ocupados: con Cualquiera se saltean 14:30-15:30 y con Ana tambien 14:00', async () => {
    const svc = nuevo();
    const cualquiera = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1, 2] });
    const horasCualquiera = cualquiera.slots.map((s) => s.hora);
    expect(horasCualquiera).toContain('14:00');
    expect(horasCualquiera).not.toContain('14:30');
    expect(horasCualquiera).not.toContain('15:30');
    expect(horasCualquiera).toContain('16:00');
    const ana = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1, 2], profesionalId: 1 });
    expect(ana.slots.map((s) => s.hora)).not.toContain('14:00');
  });

  it('un turno ocupado quita todo inicio cuyo intervalo lo solapa, y el adyacente sigue libre', async () => {
    const svc = nuevo();
    // Ana 10:00-10:45 (45 min): con un servicio de 45 min quedan fuera 09:30 (solapa) y 10:00, 10:30;
    // 09:00 (termina 09:45) y 11:00 (arranca despues del fin) quedan libres.
    await crearPendiente(svc, 'demo', {
      servicioIds: [1],
      profesionalId: 1,
      fecha: '2026-09-25',
      hora: '10:00',
      cliente: { nombre: 'A', apellido: 'B', whatsapp: '+5491155551234' },
    });
    const disp = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1], profesionalId: 1 });
    const horas = disp.slots.map((s) => s.hora);
    expect(horas).toContain('09:00');
    expect(horas).not.toContain('09:30');
    expect(horas).not.toContain('10:00');
    expect(horas).not.toContain('10:30');
    expect(horas).toContain('11:00');
  });

  it('Cualquiera fusiona por hora: un inicio sigue si al menos una profesional esta libre', async () => {
    const svc = nuevo();
    await crearPendiente(svc, 'demo', {
      servicioIds: [1],
      profesionalId: 1,
      fecha: '2026-09-25',
      hora: '10:00',
      cliente: { nombre: 'A', apellido: 'B', whatsapp: '+5491155551234' },
    });
    const disp = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1] });
    const diez = disp.slots.find((s) => s.hora === '10:00');
    expect(diez?.profesionalIds).toEqual([2]);
  });

  it('getDiasConDisponibilidad excluye fechas pasadas y dias sin horarios', async () => {
    const dias = await nuevo().getDiasConDisponibilidad('demo', {
      fechas: ['2026-09-18', '2026-09-19', '2026-09-25'],
      servicioIds: [1],
    });
    expect(dias).toEqual(['2026-09-19', '2026-09-25']);
  });

  it('los servicios sembrados traen fotos (placeholders) o vacio', async () => {
    const servicios = await nuevo().getServices('demo');
    expect(servicios.find((s) => s.id === 1)?.fotos.length).toBeGreaterThan(1);
    expect(servicios.find((s) => s.id === 2)?.fotos).toEqual([]);
  });
});
