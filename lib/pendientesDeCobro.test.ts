import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import {
  agruparPorSemana,
  cuandoFue,
  estimadoAPrecioDeLista,
  ordenarPendientes,
  resumenParaBanner,
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

describe('resumenParaBanner', () => {
  const conCliente = (
    id: number,
    nombre: string,
    apellido: string,
    servicios: string[],
    extra: Partial<Turno> = {},
  ): Turno =>
    ({
      id,
      fecha_hora: '2026-10-09 15:00:00',
      grupo_id: null,
      cliente: { nombre, apellido },
      servicios: servicios.map((n, i) => ({ id: i + 1, nombre: n })),
      ...extra,
    }) as unknown as Turno;

  const tramoDePromo = (id: number, servicio: string, fecha_hora: string, promo: string | null): Turno =>
    conCliente(id, 'Ana', 'Gómez', [servicio], {
      fecha_hora,
      grupo_id: 7,
      grupo: { id: 7, modo: 'secuencia', promo: promo ? { id: 1, nombre: promo } : null, tramos: [] },
    } as Partial<Turno>);

  it('con una visita nombra a la cliente, el servicio y cuándo fue', () => {
    expect(resumenParaBanner([conCliente(1, 'Mica', 'Bochetti', ['Capping'])]))
      .toEqual({ tipo: 'una', cliente: 'Mica Bochetti', servicios: 'Capping', fecha_hora: '2026-10-09 15:00:00' });
  });

  it('une varios servicios del mismo turno con " + "', () => {
    expect(resumenParaBanner([conCliente(1, 'Mica', 'Bochetti', ['Capping', 'Pedicura'])]))
      .toMatchObject({ tipo: 'una', servicios: 'Capping + Pedicura' });
  });

  it('una promo (varios turnos del mismo grupo) cuenta como UNA visita, con el nombre de la promo y su primer horario', () => {
    expect(resumenParaBanner([
      tramoDePromo(1, 'Pedicura', '2026-10-10 12:00:00', 'Promo Manos y pies'),
      tramoDePromo(2, 'Capping', '2026-10-10 10:30:00', 'Promo Manos y pies'),
    ])).toEqual({ tipo: 'una', cliente: 'Ana Gómez', servicios: 'Promo Manos y pies', fecha_hora: '2026-10-10 10:30:00' });
  });

  it('un grupo sin promo junta los servicios de todos sus turnos, sin repetir', () => {
    expect(resumenParaBanner([
      tramoDePromo(1, 'Capping', '2026-10-10 10:30:00', null),
      tramoDePromo(2, 'Pedicura', '2026-10-10 12:00:00', null),
      tramoDePromo(3, 'Capping', '2026-10-10 13:00:00', null),
    ])).toMatchObject({ tipo: 'una', servicios: 'Capping + Pedicura' });
  });

  it('con varias visitas devuelve cuántas y los nombres cortos, sin repetir clientes', () => {
    expect(resumenParaBanner([
      conCliente(1, 'Cristina', 'Fernández', ['Capping']),
      conCliente(2, 'Ana', 'Gómez', ['Soft gel']),
      conCliente(3, 'Cristina', 'Fernández', ['Esmaltado']),
    ])).toEqual({ tipo: 'varias', cantidad: 3, clientes: ['Cristina F.', 'Ana G.'] });
  });

  it('una visita sin nombre de cliente cae a la cantidad', () => {
    expect(resumenParaBanner([conCliente(1, '', '', ['Capping'])]))
      .toEqual({ tipo: 'varias', cantidad: 1, clientes: [] });
  });

  it('una visita sin servicios igual nombra a la cliente, sin servicio', () => {
    expect(resumenParaBanner([conCliente(1, 'Mica', 'Bochetti', [])]))
      .toMatchObject({ tipo: 'una', cliente: 'Mica Bochetti', servicios: '' });
  });

  it('sin turnos devuelve cantidad 0', () => {
    expect(resumenParaBanner([])).toEqual({ tipo: 'varias', cantidad: 0, clientes: [] });
  });
});

describe('cuandoFue', () => {
  const hoy = new Date(2026, 9, 10, 18, 0);

  it('hoy, ayer o la fecha corta, siempre con la hora', () => {
    expect(cuandoFue('2026-10-10 10:30:00', hoy)).toEqual({ dia: 'hoy', fecha: '10/10', hora: '10:30' });
    expect(cuandoFue('2026-10-09 15:00:00', hoy)).toEqual({ dia: 'ayer', fecha: '9/10', hora: '15:00' });
    expect(cuandoFue('2026-10-05 09:05:00', hoy)).toEqual({ dia: 'otro', fecha: '5/10', hora: '9:05' });
  });
});
