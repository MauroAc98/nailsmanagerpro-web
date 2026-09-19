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

  it('ofrece exactamente los horarios configurados de cada profesional: irregulares, sin intermedios ni desactivados', async () => {
    const svc = nuevo();
    const cliente = { fecha: '2026-09-25', servicioIds: [2] }; // 30 min: nada se solapa con lo ocupado salvo 15:30 de Lucia
    const ana = await svc.getAvailability('demo', { ...cliente, profesionalId: 1 });
    // Ana: 09:30, 12:00 y 15:00 desactivados; hueco de almuerzo entre 11:30 y 13:00.
    expect(ana.slots.map((s) => s.hora)).toEqual(['09:00', '10:30', '11:30', '13:00', '14:00', '16:00', '17:30']);
    const lucia = await svc.getAvailability('demo', { ...cliente, profesionalId: 2 });
    expect(lucia.slots.map((s) => s.hora)).toEqual(['09:30', '10:30', '11:00', '14:00', '16:30', '18:00']);
  });

  it('Cualquiera une los horarios de todas y lista solo a las libres en cada uno', async () => {
    const disp = await nuevo().getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1, 2] }); // 75 min
    expect(disp.slots).toEqual([
      { hora: '09:00', profesionalIds: [1] },
      { hora: '09:30', profesionalIds: [2] },
      { hora: '10:30', profesionalIds: [1, 2] },
      { hora: '11:00', profesionalIds: [2] },
      { hora: '11:30', profesionalIds: [1] },
      { hora: '13:00', profesionalIds: [1] },
      // 14:00 de Ana pisaria su turno de 15:00; el de Lucia entra ([14:00, 15:15))
      { hora: '14:00', profesionalIds: [2] },
      { hora: '16:00', profesionalIds: [1] },
      { hora: '16:30', profesionalIds: [2] },
      { hora: '17:30', profesionalIds: [1] },
      { hora: '18:00', profesionalIds: [2] },
    ]);
  });

  it('un inicio libre se descarta si el servicio completo pisa un turno posterior', async () => {
    // Kapping gel (90 min, solo Ana): 14:00 -> [14:00, 15:30) pisa su turno de 15:00-16:00
    const ana = await nuevo().getAvailability('demo', { fecha: '2026-09-25', servicioIds: [3], profesionalId: 1 });
    const horas = ana.slots.map((s) => s.hora);
    expect(horas).not.toContain('14:00');
    expect(horas).toContain('13:00'); // [13:00, 14:30) entra
    expect(horas).toContain('16:00'); // adyacente al fin del turno
  });

  it('hoy respeta la anticipacion y sigue ofreciendo solo horarios configurados', async () => {
    const disp = await nuevo().getAvailability('demo', { fecha: '2026-09-19', servicioIds: [2] });
    expect(disp.slots.map((s) => s.hora)).toEqual(['14:00', '16:00', '16:30', '17:30', '18:00']);
  });

  it('una reserva quita los horarios que pisa y deja el adyacente; con Cualquiera sigue la otra', async () => {
    const svc = nuevo();
    // Ana 10:30 con Kapping gel (90 min): ocupa [10:30, 12:00)
    await crearPendiente(svc, 'demo', {
      servicioIds: [3],
      profesionalId: 1,
      fecha: '2026-09-25',
      hora: '10:30',
      cliente: { nombre: 'A', apellido: 'B', whatsapp: '+5491155551234' },
    });
    const ana = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [2], profesionalId: 1 });
    const horas = ana.slots.map((s) => s.hora);
    expect(horas).toContain('09:00');
    expect(horas).not.toContain('10:30');
    expect(horas).not.toContain('11:30');
    expect(horas).toContain('13:00');
    const cualquiera = await svc.getAvailability('demo', { fecha: '2026-09-25', servicioIds: [2] });
    expect(cualquiera.slots.find((s) => s.hora === '10:30')?.profesionalIds).toEqual([2]);
    expect(cualquiera.slots.map((s) => s.hora)).not.toContain('11:30');
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
