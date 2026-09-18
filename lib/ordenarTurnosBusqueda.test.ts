import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { ordenarTurnosBusqueda } from './ordenarTurnosBusqueda';

function turno(id: number, fecha_hora: string, estado_visual: Turno['estado_visual']): Turno {
  return { id, fecha_hora, estado_visual, estado: estado_visual === 'completado' ? 'completado' : 'confirmado' } as Turno;
}

// "Ahora" fijo: miércoles 16/9/2026 12:00.
const AHORA = new Date(2026, 8, 16, 12, 0);

describe('ordenarTurnosBusqueda', () => {
  it('pone primero los próximos a atender (ascendente) y al final los finalizados', () => {
    const resultado = ordenarTurnosBusqueda([
      turno(1, '2026-09-10 10:00:00', 'completado'),
      turno(2, '2026-09-20 09:00:00', 'confirmado'),
      turno(3, '2026-09-17 15:00:00', 'confirmado'),
    ], AHORA);
    expect(resultado.map(t => t.id)).toEqual([3, 2, 1]);
  });

  it('el turno en curso va antes que los futuros', () => {
    const resultado = ordenarTurnosBusqueda([
      turno(1, '2026-09-16 15:00:00', 'confirmado'),
      turno(2, '2026-09-16 11:30:00', 'en_curso'),
    ], AHORA);
    expect(resultado.map(t => t.id)).toEqual([2, 1]);
  });

  it('los finalizados quedan ordenados del más reciente al más antiguo', () => {
    const resultado = ordenarTurnosBusqueda([
      turno(1, '2026-08-01 10:00:00', 'completado'),
      turno(2, '2026-09-10 10:00:00', 'completado'),
    ], AHORA);
    expect(resultado.map(t => t.id)).toEqual([2, 1]);
  });

  it('un confirmado que ya pasó sin finalizarse va después de los próximos, no antes', () => {
    const resultado = ordenarTurnosBusqueda([
      turno(1, '2026-09-01 10:00:00', 'confirmado'),
      turno(2, '2026-09-25 10:00:00', 'confirmado'),
    ], AHORA);
    expect(resultado.map(t => t.id)).toEqual([2, 1]);
  });

  it('no muta el array recibido', () => {
    const entrada = [turno(1, '2026-09-10 10:00:00', 'completado'), turno(2, '2026-09-20 09:00:00', 'confirmado')];
    ordenarTurnosBusqueda(entrada, AHORA);
    expect(entrada.map(t => t.id)).toEqual([1, 2]);
  });
});
