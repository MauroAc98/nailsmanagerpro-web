import { describe, expect, it } from 'vitest';
import {
  horaPicoDelDia, rangoMesAnterior, rangoMesAnteriorMismoPeriodo, serviciosParaBurbujas, ticketDiaSemana, ticketPromedio,
  topConOtros, unirServicios, variacionPorcentual,
} from './metricas';

describe('unirServicios', () => {
  it('une por servicio_id y calcula el ticket (monto ÷ turnos)', () => {
    const r = unirServicios(
      [{ servicio_id: 1, nombre: 'Capping', cantidad: 10 }, { servicio_id: 2, nombre: 'Soft gel', cantidad: 4 }],
      [{ servicio_id: 2, nombre: 'Soft gel', monto: 88000 }, { servicio_id: 1, nombre: 'Capping', monto: 30000 }],
    );
    expect(r).toEqual([
      { servicio_id: 2, nombre: 'Soft gel', turnos: 4, monto: 88000, ticket: 22000 },
      { servicio_id: 1, nombre: 'Capping', turnos: 10, monto: 30000, ticket: 3000 },
    ]);
  });

  it('un servicio sin monto cobrado (solo confirmados) queda con ticket null', () => {
    const r = unirServicios([{ servicio_id: 1, nombre: 'A', cantidad: 3 }], []);
    expect(r).toEqual([{ servicio_id: 1, nombre: 'A', turnos: 3, monto: 0, ticket: null }]);
  });

  it('un servicio que solo aparece en ganancias (sin turnos listados) no inventa ticket', () => {
    const r = unirServicios([], [{ servicio_id: 9, nombre: 'Z', monto: 500 }]);
    expect(r[0]).toMatchObject({ turnos: 0, monto: 500, ticket: null });
  });
});

describe('serviciosParaBurbujas', () => {
  const s = (id: number, turnos: number, monto: number) => ({
    servicio_id: id, nombre: 'S' + id, turnos, monto, ticket: monto > 0 && turnos > 0 ? monto / turnos : null,
  });

  it('con menos de 3 servicios con plata no muestra burbujas', () => {
    expect(serviciosParaBurbujas([s(1, 5, 100), s(2, 5, 100)])).toEqual([]);
  });

  it('ignora servicios sin plata cobrada al contar el mínimo', () => {
    expect(serviciosParaBurbujas([s(1, 5, 100), s(2, 5, 100), s(3, 5, 0)])).toEqual([]);
  });

  it('se queda con el top 6 por plata', () => {
    const lista = Array.from({ length: 8 }, (_, i) => s(i + 1, 5, (i + 1) * 100));
    const r = serviciosParaBurbujas(lista);
    expect(r).toHaveLength(6);
    expect(r[0].servicio_id).toBe(8);
    expect(r[5].servicio_id).toBe(3);
  });
});

describe('ticketDiaSemana', () => {
  const ritmo = [
    { dia_semana: 6, completados: 4, confirmados: 0, cancelados: 0 },
    { dia_semana: 1, completados: 0, confirmados: 2, cancelados: 0 },
  ];
  // 2026-10-03 y 2026-10-10 son sábados; 2026-10-05 es lunes.
  const ganancias = [
    { fecha: '2026-10-03', monto: 60000 }, { fecha: '2026-10-10', monto: 40000 }, { fecha: '2026-10-05', monto: 9999 },
  ];

  it('suma lo cobrado en los sábados y divide por los turnos completados de sábado', () => {
    expect(ticketDiaSemana(ganancias, ritmo, 6)).toBe(25000);
  });

  it('es null si ese día no tiene turnos completados (nada cobrado para derivar)', () => {
    expect(ticketDiaSemana(ganancias, ritmo, 1)).toBeNull();
  });

  it('el domingo es ISO 7', () => {
    expect(ticketDiaSemana([{ fecha: '2026-10-04', monto: 500 }], [{ dia_semana: 7, completados: 1, confirmados: 0, cancelados: 0 }], 7)).toBe(500);
  });
});

describe('horaPicoDelDia', () => {
  const oc = [
    { dia_semana: 6, hora: 10, cantidad: 3 }, { dia_semana: 6, hora: 11, cantidad: 7 },
    { dia_semana: 2, hora: 15, cantidad: 9 },
  ];

  it('devuelve la hora con más turnos de ESE día', () => {
    expect(horaPicoDelDia(oc, 6)).toBe(11);
    expect(horaPicoDelDia(oc, 2)).toBe(15);
  });

  it('es null si ese día no tiene turnos', () => {
    expect(horaPicoDelDia(oc, 4)).toBeNull();
  });
});

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
