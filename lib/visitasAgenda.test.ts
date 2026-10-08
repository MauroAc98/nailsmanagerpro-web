import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { agruparVisitas, pasosCancelables, turnoACancelar, type VisitaAgenda } from './visitasAgenda';

type Tramo = NonNullable<Turno['grupo']>['tramos'][number];

const MAURO = 10;
const MENGANO = 20;
const NOMBRES: Record<number, string> = { [MAURO]: 'Mauro', [MENGANO]: 'Mengano' };

const tramo = (turno_id: number, profesional_id: number, fecha_hora: string, dur: number, over: Partial<Tramo> = {}): Tramo => ({
  turno_id, profesional_id, profesional_nombre: NOMBRES[profesional_id] ?? null, fecha_hora, duracion_total_minutos: dur,
  estado: 'confirmado', servicios: [], ...over,
});

const turno = (id: number, fecha_hora: string, profesional_id: number, over: Partial<Turno> = {}): Turno =>
  ({
    id, cliente_id: 1, cliente: { nombre: 'Fulano', apellido: 'Detal' }, servicios: [], estado: 'confirmado', estado_visual: 'confirmado',
    fecha_hora, duracion_total_minutos: 30, profesional_id, ...over,
  }) as Turno;

// Grupo de dos pasos: Capping con Mauro a las 09:00 y Soft gel con Mengano a las 10:30 (mismo dia).
const PASOS = [
  tramo(1, MAURO, '2026-10-09T09:00:00', 90, { servicios: [{ id: 1, nombre: 'Capping' }] }),
  tramo(2, MENGANO, '2026-10-09T10:30:00', 120, { servicios: [{ id: 2, nombre: 'Soft gel' }] }),
];
const grupo = (tramos: Tramo[] = PASOS, promo: { id: number; nombre: string } | null = { id: 5, nombre: 'Promo Día de la Madre' }): Turno['grupo'] =>
  ({ id: 7, modo: 'secuencia', promo, tramos });
const paso1 = (over: Partial<Turno> = {}) => turno(1, '2026-10-09T09:00:00', MAURO, { grupo_id: 7, grupo: grupo(), ...over });
const paso2 = (over: Partial<Turno> = {}) => turno(2, '2026-10-09T10:30:00', MENGANO, { grupo_id: 7, grupo: grupo(), ...over });
const suelto = (id: number, hora: string, pro = MAURO) => turno(id, `2026-10-09T${hora}:00`, pro);

const visita = (item: unknown): VisitaAgenda => {
  expect((item as { tipo: string }).tipo).toBe('visita');
  return item as VisitaAgenda;
};

describe('agruparVisitas · sin filtro ("Todas")', () => {
  it('une los turnos del mismo grupo y dia en una visita con la promo y un paso por turno', () => {
    const items = agruparVisitas([paso1(), suelto(5, '11:00'), paso2()], null);

    expect(items.map((i) => i.tipo)).toEqual(['visita', 'turno']);
    const v = visita(items[0]);
    expect(v.grupoId).toBe(7);
    expect(v.promo).toEqual({ id: 5, nombre: 'Promo Día de la Madre' });
    expect(v.pasos.map((p) => [p.turnoId, p.servicios, p.profesionalNombre, p.duracionMin])).toEqual([
      [1, ['Capping'], 'Mauro', 90],
      [2, ['Soft gel'], 'Mengano', 120],
    ]);
    expect(v.pasos.every((p) => p.propio === null && !p.otroDia)).toBe(true);
    expect(v.cabecera.id).toBe(1);
    expect(v.turnos.map((t) => t.id)).toEqual([1, 2]);
  });

  it('una seleccion suelta (sin promo) trae promo null', () => {
    const g = grupo(PASOS, null);
    const v = visita(agruparVisitas([paso1({ grupo: g }), paso2({ grupo: g })], null)[0]);
    expect(v.promo).toBeNull();
  });

  it('respeta el orden de la lista: la visita queda donde esta su primer turno', () => {
    const items = agruparVisitas([suelto(5, '08:00'), paso1(), paso2(), suelto(6, '12:00')], null);
    expect(items.map((i) => (i.tipo === 'visita' ? 'visita' : (i as { turno: Turno }).turno.id))).toEqual([5, 'visita', 6]);
  });

  it('no mezcla visitas de grupos distintos', () => {
    const otro = (id: number, hora: string, pro: number) =>
      turno(id, `2026-10-09T${hora}:00`, pro, {
        grupo_id: 8, grupo: { id: 8, modo: 'secuencia', promo: null, tramos: [tramo(3, MAURO, '2026-10-09T13:00:00', 30), tramo(4, MENGANO, '2026-10-09T13:30:00', 30)] },
      });
    const items = agruparVisitas([paso1(), paso2(), otro(3, '13:00', MAURO), otro(4, '13:30', MENGANO)], null);
    expect(items.map((i) => (i as VisitaAgenda).grupoId)).toEqual([7, 8]);
  });
});

describe('agruparVisitas · pasos cancelados y completados', () => {
  it('oculta el paso cancelado', () => {
    const tramos = [PASOS[0], PASOS[1], tramo(3, MAURO, '2026-10-09T13:00:00', 30, { estado: 'cancelado' })];
    const v = visita(agruparVisitas([paso1({ grupo: grupo(tramos) }), paso2({ grupo: grupo(tramos) })], null)[0]);
    expect(v.pasos.map((p) => p.turnoId)).toEqual([1, 2]);
  });

  it('si queda un solo paso (el otro se cancelo) se muestra como un turno normal', () => {
    const tramos = [PASOS[0], { ...PASOS[1], estado: 'cancelado' as const }];
    const items = agruparVisitas([paso1({ grupo: grupo(tramos) })], null);
    expect(items).toHaveLength(1);
    expect(items[0].tipo).toBe('turno');
  });

  it('un paso completado sigue en la visita, con su estado', () => {
    const tramos = [{ ...PASOS[0], estado: 'completado' as const }, PASOS[1]];
    const v = visita(agruparVisitas([paso1({ grupo: grupo(tramos), estado: 'completado', estado_visual: 'completado' }), paso2({ grupo: grupo(tramos) })], null)[0]);
    expect(v.pasos.map((p) => p.estado)).toEqual(['completado', 'confirmado']);
  });

  it('marca el paso en curso segun el estado visual del turno', () => {
    const v = visita(agruparVisitas([paso1({ estado_visual: 'en_curso' }), paso2()], null)[0]);
    expect(v.pasos.map((p) => p.enCurso)).toEqual([true, false]);
  });
});

describe('agruparVisitas · filtro por profesional', () => {
  it('muestra la visita a quien tiene un paso, resalta su paso y deja los demas como "otro"', () => {
    const v = visita(agruparVisitas([paso1(), paso2()], MENGANO)[0]);
    expect(v.pasos.map((p) => p.propio)).toEqual([false, true]);
  });

  it('oculta la visita si la persona no tiene ningun paso ese dia, y los turnos sueltos de otros', () => {
    const items = agruparVisitas([paso1(), paso2(), suelto(5, '11:00', MAURO)], 99);
    expect(items).toEqual([]);
  });

  it('ordena por la hora del paso de la persona filtrada, no por el inicio de la visita', () => {
    // La visita empieza a las 09:00 (Mauro) pero el paso de Mengano es a las 10:30: antes hay un turno suelto suyo a las 10:00.
    const items = agruparVisitas([paso1(), suelto(5, '10:00', MENGANO), paso2()], MENGANO);
    expect(items.map((i) => (i.tipo === 'visita' ? 'visita' : (i as { turno: Turno }).turno.id))).toEqual([5, 'visita']);
  });

  it('en "Todas" ese mismo caso queda ordenado por el inicio de la visita', () => {
    const items = agruparVisitas([paso1(), suelto(5, '10:00', MENGANO), paso2()], null);
    expect(items.map((i) => (i.tipo === 'visita' ? 'visita' : (i as { turno: Turno }).turno.id))).toEqual(['visita', 5]);
  });
});

describe('agruparVisitas · pasos de otro dia y datos faltantes', () => {
  it('suma el paso de otro dia como apagado (otroDia) usando los datos del grupo', () => {
    const tramos = [PASOS[0], tramo(2, MENGANO, '2026-10-10T10:30:00', 120, { servicios: [{ id: 2, nombre: 'Soft gel' }] })];
    const v = visita(agruparVisitas([paso1({ grupo: grupo(tramos) })], null)[0]);
    expect(v.pasos.map((p) => [p.turnoId, p.otroDia, p.turno?.id])).toEqual([[1, false, 1], [2, true, undefined]]);
    expect(v.pasos[1].servicios).toEqual(['Soft gel']);
  });

  it('si la busqueda cruza dias, cada dia es su propia visita', () => {
    const tramos = [PASOS[0], tramo(2, MENGANO, '2026-10-10T10:30:00', 120)];
    const items = agruparVisitas([paso1({ grupo: grupo(tramos) }), turno(2, '2026-10-10T10:30:00', MENGANO, { grupo_id: 7, grupo: grupo(tramos) })], null);
    expect(items.map((i) => (i as VisitaAgenda).pasos.map((p) => p.otroDia))).toEqual([[false, true], [true, false]]);
  });

  it('si el backend no manda servicios en el paso, usa los del turno que esta en la lista; si no hay, queda vacio', () => {
    const tramos = [{ ...PASOS[0], servicios: undefined }, { ...PASOS[1], servicios: undefined }];
    const v = visita(agruparVisitas([
      paso1({ grupo: grupo(tramos), servicios: [{ id: 1, nombre: 'Capping' }] }),
    ], null)[0]);
    expect(v.pasos.map((p) => p.servicios)).toEqual([['Capping'], []]);
  });

  it('un turno con grupo_id pero sin datos del grupo se trata como turno normal', () => {
    const items = agruparVisitas([turno(1, '2026-10-09T09:00:00', MAURO, { grupo_id: 7 })], null);
    expect(items.map((i) => i.tipo)).toEqual(['turno']);
  });
});

describe('turnoACancelar', () => {
  const visitaDe = () => agruparVisitas([paso1(), paso2()], null)[0] as VisitaAgenda;

  it('"Todos" cancela toda la promo a partir de un turno de la visita, con alcance grupo', () => {
    expect(turnoACancelar(visitaDe(), {})).toEqual({ turnoId: 1, alcance: 'grupo' });
  });

  it('un paso elegido cancela solo el turno de ese paso, sin alcance de grupo', () => {
    const r = turnoACancelar(visitaDe(), { turnoId: 2 });

    expect(r).toEqual({ turnoId: 2, alcance: undefined });
    expect(r.alcance).toBeUndefined();
  });

  it('puede ser un paso de otro dia, que no esta en la lista', () => {
    expect(turnoACancelar(visitaDe(), { turnoId: 99 }).turnoId).toBe(99);
  });
});

describe('pasosCancelables', () => {
  const visitaDe = (...turnos: Turno[]) => agruparVisitas(turnos, null)[0] as VisitaAgenda;

  it('lista lo que se cancela y una opcion por paso, con hora, servicio y profesional', () => {
    const r = pasosCancelables(visitaDe(paso1(), paso2()));

    expect(r.pendientes).toEqual(['09:00 · con Mauro', '10:30 · con Mengano']);
    expect(r.pasos).toEqual([
      { turnoId: 1, etiqueta: '09:00 · Capping · con Mauro' },
      { turnoId: 2, etiqueta: '10:30 · Soft gel · con Mengano' },
    ]);
  });

  it('no ofrece los pasos ya completados', () => {
    const tramos = [{ ...PASOS[0], estado: 'completado' as const }, PASOS[1]];
    const r = pasosCancelables(visitaDe(
      paso1({ grupo: grupo(tramos), estado: 'completado', estado_visual: 'completado' }),
      paso2({ grupo: grupo(tramos) }),
    ));

    expect(r.pasos.map((p) => p.turnoId)).toEqual([2]);
    expect(r.pendientes).toEqual(['10:30 · con Mengano']);
  });

  it('un paso de otro dia lleva su fecha', () => {
    const tramos = [PASOS[0], tramo(2, MENGANO, '2026-10-10T10:30:00', 120, { servicios: [{ id: 2, nombre: 'Pedicura' }] })];
    const r = pasosCancelables(visitaDe(paso1({ grupo: grupo(tramos) })));

    expect(r.pasos.map((p) => p.etiqueta)).toEqual(['09:00 · Capping · con Mauro', '10/10 10:30 · Pedicura · con Mengano']);
    expect(r.pendientes).toEqual(['09:00 · con Mauro', '10/10 10:30 · con Mengano']);
  });

  it('junta con " + " los servicios de un paso y omite lo que falta', () => {
    const tramos = [
      tramo(1, MAURO, '2026-10-09T09:00:00', 90, { servicios: [{ id: 1, nombre: 'Capping' }, { id: 3, nombre: 'Esmaltado' }] }),
      tramo(2, MENGANO, '2026-10-09T10:30:00', 120, { servicios: [], profesional_nombre: null }),
    ];
    const r = pasosCancelables(visitaDe(paso1({ grupo: grupo(tramos) }), paso2({ grupo: grupo(tramos) })));

    expect(r.pasos.map((p) => p.etiqueta)).toEqual(['09:00 · Capping + Esmaltado · con Mauro', '10:30']);
  });
});
