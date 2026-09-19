import { describe, expect, it } from 'vitest';
import { describeReadsContract } from '../service.contract';
import { createMockService, memoriaStorage } from './mock';

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

  it('no ofrece slots cuyo fin excede el cierre (18:00)', async () => {
    const disp = await nuevo().getAvailability('demo', { fecha: '2026-09-25', servicioIds: [1, 2] });
    const ultima = disp.slots[disp.slots.length - 1].hora; // 75 min -> ultimo inicio 16:30
    expect(ultima).toBe('16:30');
  });
});
