import { describe, expect, it } from 'vitest';
import { brechaServicio, diaFlojo, diaPico, franjaLibre, retencion, type DiaRitmo } from './insights';

describe('brechaServicio', () => {
  const s = (id: number, nombre: string, turnos: number, monto: number) => ({ servicio_id: id, nombre, turnos, monto, ticket: monto / turnos });

  it('detecta el servicio que pesa mucho más en plata que en turnos', () => {
    // Soft gel: 25% de los turnos pero 55% de la plata
    const r = brechaServicio([s(1, 'Capping', 30, 45000), s(2, 'Soft gel', 10, 55000)]);
    expect(r).toEqual({ nombre: 'Soft gel', pctTurnos: 25, pctPlata: 55 });
  });

  it('no da consejo si la brecha no es significativa (<10 puntos)', () => {
    expect(brechaServicio([s(1, 'A', 20, 50000), s(2, 'B', 20, 52000)])).toBeNull();
  });

  it('no da consejo con pocos turnos', () => {
    expect(brechaServicio([s(1, 'A', 2, 1000), s(2, 'B', 1, 9000)])).toBeNull();
  });

  it('no da consejo sin plata cobrada', () => {
    expect(brechaServicio([s(1, 'A', 10, 0), s(2, 'B', 10, 0)])).toBeNull();
  });
});

const semana = (vals: number[], cancelados = 0): DiaRitmo[] =>
  vals.map((completados, i) => ({ dia_semana: i + 1, completados, confirmados: 0, cancelados }));

describe('diaPico', () => {
  it('devuelve el día con más turnos y su porcentaje del total', () => {
    // lunes..domingo: sábado (6) concentra 18 de 40
    const r = diaPico(semana([3, 4, 5, 3, 4, 18, 3]));
    expect(r).toEqual({ dia_semana: 6, pct: 45 });
  });

  it('cuenta completados + confirmados, no cancelados', () => {
    const dias: DiaRitmo[] = semana([5, 5, 5, 5, 5, 5, 5]).map(d =>
      d.dia_semana === 2 ? { ...d, cancelados: 40 } : d,
    );
    const r = diaPico(dias);
    expect(r?.dia_semana).not.toBe(2);
  });

  it('no da consejo con pocos turnos (<10)', () => {
    expect(diaPico(semana([1, 0, 2, 0, 1, 3, 0]))).toBeNull();
  });

  it('no da consejo si todos los días empatan', () => {
    expect(diaPico(semana([3, 3, 3, 3, 3, 3, 3]))).toBeNull();
  });
});

describe('diaFlojo', () => {
  it('devuelve el día más flojo con su porcentaje', () => {
    const r = diaFlojo(semana([2, 6, 6, 6, 6, 10, 4]));
    expect(r).toEqual({ dia_semana: 1, pct: 5 });
  });

  it('no da consejo con pocos turnos', () => {
    expect(diaFlojo(semana([0, 1, 1, 1, 1, 2, 0]))).toBeNull();
  });

  it('no da consejo si todos los días empatan', () => {
    expect(diaFlojo(semana([4, 4, 4, 4, 4, 4, 4]))).toBeNull();
  });
});

describe('franjaLibre', () => {
  const celdas = (items: [number, number, number][]) =>
    items.map(([dia_semana, hora, cantidad]) => ({ dia_semana, hora, cantidad }));

  it('encuentra la franja (día + mañana/tarde) más vacía cuando hay horas en ambas franjas', () => {
    // martes (2) a la mañana vacío; el resto con movimiento
    const data = celdas([
      [1, 10, 4], [1, 15, 4],
      [2, 15, 5],
      [3, 10, 4], [3, 15, 4],
      [4, 10, 4], [4, 15, 4],
      [5, 10, 4], [5, 15, 4],
      [6, 10, 6], [6, 15, 6],
      [7, 10, 2], [7, 15, 2],
    ]);
    expect(franjaLibre(data)).toEqual({ dia_semana: 2, franja: 'manana' });
  });

  it('no da consejo con pocos datos', () => {
    expect(franjaLibre(celdas([[1, 10, 1], [2, 15, 2]]))).toBeNull();
  });

  it('no da consejo si la ocupación es pareja', () => {
    const data: ReturnType<typeof celdas> = [];
    for (let d = 1; d <= 7; d++) {
      data.push({ dia_semana: d, hora: 10, cantidad: 3 }, { dia_semana: d, hora: 15, cantidad: 3 });
    }
    expect(franjaLibre(data)).toBeNull();
  });

  it('ignora una franja que no existe en los datos (todo el movimiento es a la tarde)', () => {
    const data: ReturnType<typeof celdas> = [];
    for (let d = 1; d <= 7; d++) data.push({ dia_semana: d, hora: 15, cantidad: d === 3 ? 1 : 6 });
    const r = franjaLibre(data);
    expect(r?.franja).toBe('tarde');
  });
});

describe('retencion', () => {
  it('devuelve el porcentaje de clientas recurrentes', () => {
    expect(retencion(3, 41)).toEqual({ pct: 93 });
  });

  it('no da consejo con muy pocas clientas (<5)', () => {
    expect(retencion(1, 2)).toBeNull();
  });
});
