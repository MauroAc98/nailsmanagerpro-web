import { describe, expect, it } from 'vitest';
import type { Turno } from '@/services/turnoService';
import { filaDePago, hoyLocal, parsePagoFiltro, rangoDeCobros } from './cobros';

const LISTA = new Map<number, string | null>([[1, '10000'], [2, '5000'], [3, null]]);

interface Opts {
  id?: number;
  estado?: Turno['estado'];
  servicios?: { id: number; precio?: string | null }[];
  sena?: unknown;
}

const turno = ({ id = 1, estado = 'confirmado', servicios = [{ id: 1 }], sena }: Opts = {}) => {
  const t: Record<string, unknown> = {
    id,
    estado,
    fecha_hora: '2026-10-04 10:00:00',
    cliente: { nombre: 'Ana', apellido: 'Test' },
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

// Estas reglas las comparte el backend para la lista (CobrosCalculator, con sus
// propios tests): los escenarios son los mismos a propósito.
describe('filaDePago — derivación del estado de pago', () => {
  it('confirmado sin seña: sin pago, falta el precio de lista', () => {
    const f = filaDePago(turno(), LISTA)!;
    expect(f.pago).toBe('nada');
    expect(f.faltaFila).toBe(10000);
  });

  it('confirmado con seña aprobada menor al precio: solo seña', () => {
    const f = filaDePago(turno({ sena: sena(4000) }), LISTA)!;
    expect(f.pago).toBe('sena');
    expect(f.sena).toBe(4000);
    expect(f.faltaFila).toBe(6000);
  });

  it('confirmado con seña que cubre el precio: pagó todo, falta 0', () => {
    const f = filaDePago(turno({ sena: sena(10000) }), LISTA)!;
    expect(f.pago).toBe('todo');
    expect(f.faltaFila).toBe(0);
  });

  it('seña pendiente, rechazada o expirada no cuenta como pagada', () => {
    for (const estado of ['pendiente', 'rechazado', 'expirado']) {
      const f = filaDePago(turno({ sena: sena(4000, 7, estado) }), LISTA)!;
      expect(f.pago).toBe('nada');
      expect(f.sena).toBe(0);
    }
  });

  it('tolera un backend viejo sin el campo sena', () => {
    const f = filaDePago(turno(), LISTA)!;
    expect(f.sena).toBe(0);
    expect(f.reservaId).toBeNull();
  });

  it('confirmado con un servicio sin precio de lista: falta desconocida', () => {
    const f = filaDePago(turno({ servicios: [{ id: 3 }], sena: sena(2000) }), LISTA)!;
    expect(f.pago).toBe('sena');
    expect(f.precio).toBeNull();
    expect(f.faltaFila).toBeNull();
  });

  it('finalizado con todos los precios cargados: pagó todo y suma el pivot', () => {
    const f = filaDePago(turno({ estado: 'completado', servicios: [{ id: 1, precio: '8000' }, { id: 2, precio: '4000.50' }] }), LISTA)!;
    expect(f.pago).toBe('todo');
    expect(f.cobrado).toBe(12000.5);
    expect(f.finalizado).toBe(true);
  });

  it('finalizado con algún precio sin cargar: falta cargar el precio', () => {
    const f = filaDePago(turno({ estado: 'completado', servicios: [{ id: 1, precio: '8000' }, { id: 2, precio: null }] }), LISTA)!;
    expect(f.pago).toBe('sinprecio');
    expect(f.cobrado).toBeNull();
  });

  it('finalizado cobrado en 0: sin pago', () => {
    const f = filaDePago(turno({ estado: 'completado', servicios: [{ id: 1, precio: '0' }] }), LISTA)!;
    expect(f.pago).toBe('nada');
    expect(f.cobrado).toBe(0);
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

  it('hoyLocal: la fecha del reloj de quien usa la app, sin pasar por UTC', () => {
    expect(hoyLocal(new Date(2026, 9, 4, 23, 59))).toBe('2026-10-04');
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
