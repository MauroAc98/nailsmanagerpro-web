import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import {
  agruparPorSemana,
  estimadoAPrecioDeLista,
  ordenarPendientes,
  tienePrecioDeListaCompleto,
} from './pendientesDeCobro';

function turno(id: number, fecha_hora: string, servicioIds: number[] = [1]): Turno {
  return { id, fecha_hora, servicios: servicioIds.map(sid => ({ id: sid, nombre: `S${sid}` })) } as unknown as Turno;
}

const referencias = new Map<number, string | null>([[1, '18000'], [2, '4500'], [3, null]]);

describe('estimadoAPrecioDeLista', () => {
  it('suma el precio de lista de los servicios del turno', () => {
    expect(estimadoAPrecioDeLista(turno(1, '2026-09-16 12:30:00', [1, 2]), referencias)).toBe(22500);
  });

  it('ignora los servicios sin precio de lista', () => {
    expect(estimadoAPrecioDeLista(turno(1, '2026-09-16 12:30:00', [1, 3]), referencias)).toBe(18000);
  });
});

describe('tienePrecioDeListaCompleto', () => {
  it('true solo si TODOS los servicios tienen precio de lista', () => {
    expect(tienePrecioDeListaCompleto(turno(1, '2026-09-16 12:30:00', [1, 2]), referencias)).toBe(true);
    expect(tienePrecioDeListaCompleto(turno(1, '2026-09-16 12:30:00', [1, 3]), referencias)).toBe(false);
  });
});

describe('ordenarPendientes', () => {
  const a = turno(1, '2026-09-10 10:00:00');
  const b = turno(2, '2026-09-16 10:00:00');
  const c = turno(3, '2026-09-12 10:00:00');

  it('más antiguos primero', () => {
    expect(ordenarPendientes([b, a, c], 'antiguos').map(t => t.id)).toEqual([1, 3, 2]);
  });

  it('más recientes primero', () => {
    expect(ordenarPendientes([a, b, c], 'recientes').map(t => t.id)).toEqual([2, 3, 1]);
  });

  it('no muta el array recibido', () => {
    const entrada = [b, a];
    ordenarPendientes(entrada, 'antiguos');
    expect(entrada.map(t => t.id)).toEqual([2, 1]);
  });
});

describe('agruparPorSemana', () => {
  // "Hoy" = miércoles 16/9/2026. Semana (lun-dom): 14-20 sept.
  const hoy = new Date(2026, 8, 16);

  it('separa esta semana, la semana pasada y las anteriores, respetando el orden de aparición', () => {
    const lista = [
      turno(1, '2026-08-20 10:00:00'), // anterior
      turno(2, '2026-09-08 10:00:00'), // semana pasada (7-13)
      turno(3, '2026-09-14 09:00:00'), // esta semana
    ];
    const grupos = agruparPorSemana(lista, hoy);
    expect(grupos.map(g => g.grupo)).toEqual(['anteriores', 'semanaPasada', 'estaSemana']);
    expect(grupos.map(g => g.turnos.map(t => t.id))).toEqual([[1], [2], [3]]);
  });

  it('agrupa turnos consecutivos de la misma semana en un solo grupo', () => {
    const lista = [turno(1, '2026-09-14 09:00:00'), turno(2, '2026-09-16 10:00:00')];
    const grupos = agruparPorSemana(lista, hoy);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].turnos).toHaveLength(2);
  });

  it('el domingo cuenta dentro de la semana de lunes a domingo', () => {
    const grupos = agruparPorSemana([turno(1, '2026-09-13 20:00:00')], hoy); // dom 13 = semana pasada
    expect(grupos[0].grupo).toBe('semanaPasada');
  });
});
