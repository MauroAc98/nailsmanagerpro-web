import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { armarFilas, filaDePago, filtrarFilas, parsePagoFiltro, rangoDeCobros, resumir } from './cobros';

const LISTA = new Map<number, string | null>([[1, '10000'], [2, '5000'], [3, null]]);

interface Opts {
  id?: number;
  estado?: Turno['estado'];
  servicios?: { id: number; precio?: string | null }[];
  sena?: unknown;
  nombre?: string;
  fecha?: string;
}

const turno = ({ id = 1, estado = 'confirmado', servicios = [{ id: 1 }], sena, nombre = 'Ana', fecha = '2026-10-04 10:00:00' }: Opts = {}) => {
  const t: Record<string, unknown> = {
    id,
    estado,
    fecha_hora: fecha,
    cliente: { nombre, apellido: 'Test' },
    servicios: servicios.map(s => ({
      id: s.id,
      nombre: `S${s.id}`,
      pivot: { precio: s.precio === undefined ? null : s.precio },
    })),
  };
  if (sena !== undefined) t.sena = sena;
  return t as unknown as Turno;
};
const sena = (monto: number, reserva = 7, estado = 'aprobado') => ({ monto, estado, reserva_web_id: reserva });

describe('armarFilas — pill derivation', () => {
  it('confirmado sin seña: sin pago, falta el precio de lista', () => {
    const [f] = armarFilas([turno()], LISTA);
    expect(f.pago).toBe('nada');
    expect(f.faltaFila).toBe(10000);
  });

  it('confirmado con seña aprobada menor al precio: solo seña', () => {
    const [f] = armarFilas([turno({ sena: sena(4000) })], LISTA);
    expect(f.pago).toBe('sena');
    expect(f.sena).toBe(4000);
    expect(f.faltaFila).toBe(6000);
  });

  it('confirmado con seña que cubre el precio: pagó todo, falta 0', () => {
    const [f] = armarFilas([turno({ sena: sena(10000) })], LISTA);
    expect(f.pago).toBe('todo');
    expect(f.faltaFila).toBe(0);
  });

  it('seña pendiente, rechazada o expirada no cuenta como pagada', () => {
    for (const estado of ['pendiente', 'rechazado', 'expirado']) {
      const [f] = armarFilas([turno({ sena: sena(4000, 7, estado) })], LISTA);
      expect(f.pago).toBe('nada');
      expect(f.sena).toBe(0);
    }
  });

  it('tolera un backend viejo sin el campo sena', () => {
    const [f] = armarFilas([turno()], LISTA);
    expect(f.sena).toBe(0);
    expect(f.reservaId).toBeNull();
  });

  it('confirmado con un servicio sin precio de lista: falta desconocida', () => {
    const [f] = armarFilas([turno({ servicios: [{ id: 3 }], sena: sena(2000) })], LISTA);
    expect(f.pago).toBe('sena');
    expect(f.precio).toBeNull();
    expect(f.faltaFila).toBeNull();
  });

  it('finalizado con todos los precios cargados: pagó todo y suma el pivot', () => {
    const [f] = armarFilas([turno({ estado: 'completado', servicios: [{ id: 1, precio: '8000' }, { id: 2, precio: '4000.50' }] })], LISTA);
    expect(f.pago).toBe('todo');
    expect(f.cobrado).toBe(12000.5);
    expect(f.finalizado).toBe(true);
  });

  it('finalizado con algún precio sin cargar: falta cargar el precio', () => {
    const [f] = armarFilas([turno({ estado: 'completado', servicios: [{ id: 1, precio: '8000' }, { id: 2, precio: null }] })], LISTA);
    expect(f.pago).toBe('sinprecio');
    expect(f.cobrado).toBeNull();
  });

  it('finalizado cobrado en 0: sin pago', () => {
    const [f] = armarFilas([turno({ estado: 'completado', servicios: [{ id: 1, precio: '0' }] })], LISTA);
    expect(f.pago).toBe('nada');
    expect(f.cobrado).toBe(0);
  });

  it('descarta cancelados y ordena del más reciente al más antiguo', () => {
    const filas = armarFilas(
      [
        turno({ id: 1, fecha: '2026-10-01 10:00:00' }),
        turno({ id: 2, estado: 'cancelado' }),
        turno({ id: 3, fecha: '2026-10-05 10:00:00' }),
      ],
      LISTA,
    );
    expect(filas.map(f => f.turno.id)).toEqual([3, 1]);
  });

  it('turnos de una misma reserva comparten seña: no se muestra falta por fila', () => {
    const filas = armarFilas(
      [turno({ id: 1, sena: sena(5000, 9) }), turno({ id: 2, servicios: [{ id: 2 }], sena: sena(5000, 9) })],
      LISTA,
    );
    expect(filas.every(f => f.senaCompartida && f.faltaFila === null)).toBe(true);
  });
});

describe('filtrarFilas', () => {
  const filas = armarFilas(
    [
      turno({ id: 1, nombre: 'María José', sena: sena(4000, 1) }),
      turno({ id: 2, nombre: 'Lucía' }),
      turno({ id: 3, nombre: 'Paula', estado: 'completado', servicios: [{ id: 1, precio: '9000' }] }),
      turno({ id: 4, nombre: 'Sofía', estado: 'completado', servicios: [{ id: 1, precio: null }] }),
    ],
    LISTA,
  );
  const ids = (r: typeof filas) => r.map(f => f.turno.id).sort();

  it('combina turno y pago', () => {
    expect(ids(filtrarFilas(filas, { turno: 'confirmado', pago: 'sena', q: '' }))).toEqual([1]);
    expect(ids(filtrarFilas(filas, { turno: 'finalizado', pago: 'sinprecio', q: '' }))).toEqual([4]);
    expect(ids(filtrarFilas(filas, { turno: 'todos', pago: 'todos', q: '' }))).toEqual([1, 2, 3, 4]);
  });

  it('busca por nombre sin importar tildes ni mayúsculas', () => {
    expect(ids(filtrarFilas(filas, { turno: 'todos', pago: 'todos', q: 'maria jose' }))).toEqual([1]);
    expect(ids(filtrarFilas(filas, { turno: 'todos', pago: 'todos', q: 'SOFIA' }))).toEqual([4]);
  });
});

describe('resumir', () => {
  it('suma la seña una sola vez por reserva', () => {
    const filas = armarFilas(
      [turno({ id: 1, sena: sena(5000, 9) }), turno({ id: 2, servicios: [{ id: 2 }], sena: sena(5000, 9) }), turno({ id: 3, sena: sena(1000, 10) })],
      LISTA,
    );
    expect(resumir(filas, LISTA).senaCobrada).toBe(6000);
  });

  it('falta cobrar: precio de los confirmados menos la seña, sin negativos', () => {
    const filas = armarFilas(
      [
        turno({ id: 1, sena: sena(4000, 1) }), // 10000 - 4000
        turno({ id: 2, servicios: [{ id: 2 }] }), // 5000
        turno({ id: 3, sena: sena(12000, 2) }), // seña > precio: 0
      ],
      LISTA,
    );
    expect(resumir(filas, LISTA).faltaCobrar).toBe(11000);
  });

  it('en una reserva compartida resta la seña una vez sobre la suma de sus turnos', () => {
    const filas = armarFilas(
      [turno({ id: 1, sena: sena(5000, 9) }), turno({ id: 2, servicios: [{ id: 2 }], sena: sena(5000, 9) })],
      LISTA,
    );
    expect(resumir(filas, LISTA).faltaCobrar).toBe(10000); // 15000 - 5000
  });

  it('cobrado en finalizados suma solo los registrados; los sin precio se cuentan aparte', () => {
    const filas = armarFilas(
      [
        turno({ id: 1, estado: 'completado', servicios: [{ id: 1, precio: '9000' }] }),
        turno({ id: 2, estado: 'completado', servicios: [{ id: 1, precio: null }, { id: 2, precio: null }] }),
      ],
      LISTA,
    );
    const r = resumir(filas, LISTA);
    expect(r.cobradoFinalizados).toBe(9000);
    expect(r.sinPrecioCount).toBe(1);
    expect(r.sinPrecioEstimado).toBe(15000);
  });

  it('lista vacía: todo en cero', () => {
    expect(resumir([], LISTA)).toEqual({ senaCobrada: 0, cobradoFinalizados: 0, faltaCobrar: 0, sinPrecioCount: 0, sinPrecioEstimado: 0 });
  });
});

describe('helpers', () => {
  it('parsePagoFiltro acepta solo valores válidos', () => {
    expect(parsePagoFiltro('sinprecio')).toBe('sinprecio');
    expect(parsePagoFiltro('otra')).toBe('todos');
    expect(parsePagoFiltro(null)).toBe('todos');
  });

  it('rangoDeCobros: 90 días atrás y 60 adelante, en fecha local', () => {
    expect(rangoDeCobros(new Date(2026, 9, 4))).toEqual({ desde: '2026-07-06', hasta: '2026-12-03' });
  });
});

describe('filaDePago — single turno detail', () => {
  it('cancelado: nada que mostrar', () => {
    expect(filaDePago(turno({ estado: 'cancelado', sena: sena(4000) }), LISTA)).toBeNull();
  });

  it('confirmado sin seña y sin precio de lista: nada que mostrar', () => {
    expect(filaDePago(turno({ servicios: [{ id: 3 }] }), LISTA)).toBeNull();
  });

  it('confirmado con seña: total de lista, seña y falta', () => {
    const f = filaDePago(turno({ sena: sena(4000) }), LISTA)!;
    expect(f.precio).toBe(10000);
    expect(f.sena).toBe(4000);
    expect(f.faltaFila).toBe(6000);
    expect(f.senaCompartida).toBe(false);
  });

  it('confirmado de un grupo con seña: seña compartida, sin falta por turno', () => {
    const t = {
      ...turno({ sena: sena(4000) }),
      grupo: { id: 1, modo: null, tramos: [
        { turno_id: 1, estado: 'confirmado' }, { turno_id: 2, estado: 'confirmado' },
      ] },
    } as unknown as Turno;
    const f = filaDePago(t, LISTA)!;
    expect(f.senaCompartida).toBe(true);
    expect(f.faltaFila).toBeNull();
  });

  it('grupo con un solo tramo vivo: la seña no se comparte', () => {
    const t = {
      ...turno({ sena: sena(4000) }),
      grupo: { id: 1, modo: null, tramos: [
        { turno_id: 1, estado: 'confirmado' }, { turno_id: 2, estado: 'cancelado' },
      ] },
    } as unknown as Turno;
    expect(filaDePago(t, LISTA)!.senaCompartida).toBe(false);
  });

  it('finalizado con precios: cobrado', () => {
    const f = filaDePago(turno({ estado: 'completado', servicios: [{ id: 1, precio: '9000' }] }), LISTA)!;
    expect(f.finalizado).toBe(true);
    expect(f.cobrado).toBe(9000);
  });

  it('finalizado sin precios: sinprecio', () => {
    expect(filaDePago(turno({ estado: 'completado' }), LISTA)!.pago).toBe('sinprecio');
  });
});
