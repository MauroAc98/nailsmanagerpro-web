import { describe, expect, it } from 'vitest';
import { rangoMesAnterior, rangoMesAnteriorMismoPeriodo, ticketPromedio, topConOtros, variacionPorcentual } from './metricas';

describe('rangoMesAnteriorMismoPeriodo', () => {
  it('en el mes en curso va del día 1 al mismo día del mes anterior', () => {
    expect(rangoMesAnteriorMismoPeriodo(new Date(2026, 9, 1), new Date(2026, 9, 2)))
      .toEqual({ desde: '2026-09-01', hasta: '2026-09-02', dia: 2 });
  });

  it('se recorta al último día del mes anterior si es más corto', () => {
    expect(rangoMesAnteriorMismoPeriodo(new Date(2026, 2, 1), new Date(2026, 2, 31)))
      .toEqual({ desde: '2026-02-01', hasta: '2026-02-28', dia: 28 });
  });

  it('cruza el año en enero', () => {
    expect(rangoMesAnteriorMismoPeriodo(new Date(2026, 0, 1), new Date(2026, 0, 10)))
      .toEqual({ desde: '2025-12-01', hasta: '2025-12-10', dia: 10 });
  });

  it('es null para un mes ya cerrado', () => {
    expect(rangoMesAnteriorMismoPeriodo(new Date(2026, 8, 1), new Date(2026, 9, 2))).toBeNull();
  });

  it('es null para un mes futuro', () => {
    expect(rangoMesAnteriorMismoPeriodo(new Date(2026, 10, 1), new Date(2026, 9, 2))).toBeNull();
  });
});

describe('topConOtros', () => {
  const items = [
    { nombre: 'A', valor: 10 }, { nombre: 'B', valor: 8 }, { nombre: 'C', valor: 5 },
    { nombre: 'D', valor: 3 }, { nombre: 'E', valor: 2 }, { nombre: 'F', valor: 1 },
  ];

  it('agrupa lo que excede el top N en "Otros" sumando los valores', () => {
    expect(topConOtros(items, 4, 'Otros')).toEqual([
      { nombre: 'A', valor: 10 }, { nombre: 'B', valor: 8 }, { nombre: 'C', valor: 5 }, { nombre: 'D', valor: 3 },
      { nombre: 'Otros', valor: 3 },
    ]);
  });

  it('ordena de mayor a menor antes de cortar', () => {
    const r = topConOtros([{ nombre: 'x', valor: 1 }, { nombre: 'y', valor: 9 }], 4, 'Otros');
    expect(r.map(i => i.nombre)).toEqual(['y', 'x']);
  });

  it('no agrega "Otros" si todo entra en el top', () => {
    expect(topConOtros(items.slice(0, 3), 4, 'Otros')).toHaveLength(3);
  });

  it('con un solo excedente igual lo muestra como su propio nombre, no como "Otros"', () => {
    const r = topConOtros(items.slice(0, 5), 4, 'Otros');
    expect(r[4]).toEqual({ nombre: 'E', valor: 2 });
  });

  it('descarta valores en 0', () => {
    expect(topConOtros([{ nombre: 'z', valor: 0 }, { nombre: 'a', valor: 2 }], 4, 'Otros')).toEqual([{ nombre: 'a', valor: 2 }]);
  });
});

describe('variacionPorcentual', () => {
  it('calcula el cambio porcentual redondeado', () => {
    expect(variacionPorcentual(1120, 1000)).toBe(12);
    expect(variacionPorcentual(900, 1000)).toBe(-10);
  });

  it('es null cuando no hay base de comparación (mes previo en 0 o negativo)', () => {
    expect(variacionPorcentual(500, 0)).toBeNull();
    expect(variacionPorcentual(500, -20)).toBeNull();
  });

  it('es 0 cuando no cambió', () => {
    expect(variacionPorcentual(1000, 1000)).toBe(0);
  });
});

describe('ticketPromedio', () => {
  it('divide ganancias por turnos, redondeando', () => {
    expect(ticketPromedio(1560000, 68)).toBe(22941);
  });

  it('es null sin turnos', () => {
    expect(ticketPromedio(0, 0)).toBeNull();
  });
});

describe('rangoMesAnterior', () => {
  it('da el mes calendario anterior completo en componentes locales', () => {
    expect(rangoMesAnterior(new Date(2026, 9, 1))).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
  });

  it('cruza el año en enero', () => {
    expect(rangoMesAnterior(new Date(2026, 0, 15))).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
  });

  it('febrero bisiesto', () => {
    expect(rangoMesAnterior(new Date(2028, 2, 1))).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });
});
