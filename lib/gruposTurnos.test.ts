import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { barrasDeGrupo, nombresDeLosOtros } from './gruposTurnos';

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

describe('nombresDeLosOtros', () => {
  it('un turno sin grupo no nombra a nadie', () => {
    expect(nombresDeLosOtros(turno(1, '10:00'))).toEqual([]);
  });

  it('nombra a las otras profesionales del grupo, sin la del propio turno', () => {
    expect(nombresDeLosOtros(deGrupo(1, '10:00', 60, 7, 10))).toEqual(['Laura']);
    expect(nombresDeLosOtros(deGrupo(2, '11:00', 45, 7, 20))).toEqual(['Ana']);
  });

  it('ignora los tramos cancelados y no repite nombres', () => {
    const t = deGrupo(1, '10:00', 60);
    t.grupo = { ...t.grupo!, tramos: [...TRAMOS, tramo(3, 20, 'Laura', '12:00', 30), tramo(4, 30, 'Sol', '13:00', 30, 'cancelado')] };
    expect(nombresDeLosOtros(t)).toEqual(['Laura']);
  });
});

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
