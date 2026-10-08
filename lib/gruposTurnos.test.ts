import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { barrasDeGrupo, etiquetaTramo, resumenMovimiento, tramosPendientes } from './gruposTurnos';

type Tramo = NonNullable<Turno['grupo']>['tramos'][number];
const tramo = (turno_id: number, profesional_id: number, nombre: string, hora: string, dur: number, estado = 'confirmado'): Tramo => ({
  turno_id, profesional_id, profesional_nombre: nombre, fecha_hora: `2026-09-17T${hora}:00`, duracion_total_minutos: dur,
  estado: estado as Tramo['estado'],
});
const TRAMOS = [tramo(1, 10, 'Ana', '10:00', 60), tramo(2, 20, 'Laura', '11:00', 45)];

const turno = (id: number, hora: string, over: Partial<Turno> = {}): Turno =>
  ({
    id, cliente_id: 1, cliente: { nombre: 'C', apellido: 'D' }, servicios: [], estado: 'confirmado', estado_visual: 'confirmado',
    fecha_hora: `2026-09-17T${hora}:00`, duracion_total_minutos: 30, profesional_id: 10, ...over,
  }) as Turno;
const deGrupo = (id: number, hora: string, dur: number, grupo = 7, pro = 10): Turno =>
  turno(id, hora, { grupo_id: grupo, duracion_total_minutos: dur, profesional_id: pro, grupo: { id: grupo, modo: 'secuencia', tramos: TRAMOS } });

describe('barrasDeGrupo', () => {
  it('une con una barra a los tramos contiguos del mismo grupo', () => {
    const b = barrasDeGrupo([deGrupo(1, '10:00', 60), deGrupo(2, '11:00', 45, 7, 20)]);
    expect(b.get(1)).toEqual({ arriba: false, abajo: true });
    expect(b.get(2)).toEqual({ arriba: true, abajo: false });
  });

  it('tambien une tramos en paralelo (mismo inicio)', () => {
    const b = barrasDeGrupo([deGrupo(1, '10:00', 60), deGrupo(2, '10:00', 45, 7, 20)]);
    expect(b.get(1)?.abajo).toBe(true);
  });

  it('no dibuja barra si hay otro turno entre medio o un hueco de tiempo', () => {
    expect(barrasDeGrupo([deGrupo(1, '10:00', 60), turno(5, '10:30'), deGrupo(2, '11:00', 45, 7, 20)]).size).toBe(0);
    expect(barrasDeGrupo([deGrupo(1, '10:00', 30), deGrupo(2, '11:00', 45, 7, 20)]).size).toBe(0);
  });

  it('no une turnos de grupos distintos y los turnos sin grupo no tienen barra', () => {
    expect(barrasDeGrupo([deGrupo(1, '10:00', 60, 7), deGrupo(2, '11:00', 45, 8, 20), turno(3, '12:00')]).size).toBe(0);
  });
});

describe('etiquetaTramo y tramosPendientes', () => {
  const t = (): Turno => ({ ...deGrupo(1, '10:00', 60), servicios: [{ id: 1, nombre: 'Softgel' }] }) as Turno;

  it('nombra el turno con su servicio y su propia profesional', () => {
    expect(etiquetaTramo(t())).toBe('Softgel · con Ana');
  });

  it('un turno sin grupo se nombra solo por su servicio', () => {
    expect(etiquetaTramo({ ...turno(1, '10:00'), servicios: [{ id: 1, nombre: 'Softgel' }] } as Turno)).toBe('Softgel');
  });

  it('los pendientes son los tramos que no estan cancelados ni completados', () => {
    const g = t();
    g.grupo = { ...g.grupo!, tramos: [TRAMOS[0], { ...TRAMOS[1], estado: 'completado' }, tramo(3, 30, 'Sol', '12:00', 30, 'cancelado'), tramo(4, 40, 'Eva', '13:00', 30)] };
    expect(tramosPendientes(g).map((x) => x.turno_id)).toEqual([1, 4]);
  });
});

describe('resumenMovimiento', () => {
  it('un turno sin grupo no lleva aviso', () => {
    expect(resumenMovimiento(turno(1, '10:00'), '2026-09-17 15:00:00')).toBeNull();
  });

  it('solo se mueve el turno editado; los otros siguen a su hora', () => {
    const t = deGrupo(2, '11:00', 45, 7, 20);
    expect(resumenMovimiento(t, '2026-09-17 15:00:00')).toEqual({
      movido: { nombre: 'Laura', hora: '15:00' },
      quedan: [{ nombre: 'Ana', hora: '10:00' }],
    });
  });

  it('sin cambio de horario, o sin otros tramos vigentes, no hay aviso', () => {
    expect(resumenMovimiento(deGrupo(2, '11:00', 45, 7, 20), '2026-09-17 11:00:00')).toBeNull();
    const solo = deGrupo(2, '11:00', 45, 7, 20);
    solo.grupo = { ...solo.grupo!, tramos: [TRAMOS[1], { ...TRAMOS[0], estado: 'cancelado' }] };
    expect(resumenMovimiento(solo, '2026-09-17 15:00:00')).toBeNull();
  });
});
