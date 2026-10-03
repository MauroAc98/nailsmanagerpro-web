import { describe, expect, it } from 'vitest';
import { acumular, alinearPrevio, diferenciaAcumulada, promedioDiario } from './acumulado';

describe('acumular', () => {
  it('suma corrida de los montos diarios', () => {
    expect(acumular([100, 200, 50])).toEqual([100, 300, 350]);
  });

  it('los días futuros (null) quedan null: la curva se corta, no se aplana', () => {
    expect(acumular([100, 200, null, null])).toEqual([100, 300, null, null]);
  });

  it('un día sin cobros (0) mantiene el acumulado', () => {
    expect(acumular([100, 0, 0])).toEqual([100, 100, 100]);
  });

  it('serie vacía', () => {
    expect(acumular([])).toEqual([]);
  });
});

describe('alinearPrevio', () => {
  it('acumula el mes previo y lo recorta/rellena al largo del mes actual', () => {
    // previo de 3 días vs mes actual de 5: los días que el previo no tiene quedan undefined
    expect(alinearPrevio([10, 20, 30], 5)).toEqual([10, 30, 60, undefined, undefined]);
  });

  it('si el mes previo es más largo, se recorta al largo del actual', () => {
    expect(alinearPrevio([10, 10, 10, 10], 3)).toEqual([10, 20, 30]);
  });
});

describe('diferenciaAcumulada', () => {
  it('compara el acumulado de hoy contra el del mes previo a igual día', () => {
    const actual = [100, 300, 700, null, null];
    const previo = [50, 150, 400, 900, 1200];
    expect(diferenciaAcumulada(actual, previo)).toEqual({ dia: 3, diff: 300 });
  });

  it('diferencia negativa cuando va por debajo', () => {
    expect(diferenciaAcumulada([100, 200], [300, 600])).toEqual({ dia: 2, diff: -400 });
  });

  it('es null sin base de comparación (previo en 0 a ese día)', () => {
    expect(diferenciaAcumulada([100, 200], [0, 0])).toBeNull();
  });

  it('es null si el mes actual todavía no tiene ningún dato', () => {
    expect(diferenciaAcumulada([null, null], [10, 20])).toBeNull();
  });

  it('si el previo es más corto, compara contra su último día disponible', () => {
    expect(diferenciaAcumulada([100, 200, 300], [100, 150, undefined])).toEqual({ dia: 3, diff: 150 });
  });
});

describe('promedioDiario', () => {
  it('promedia solo los días ya transcurridos (ignora null)', () => {
    expect(promedioDiario([100, 200, null, null])).toBe(150);
  });

  it('los días con 0 cuentan', () => {
    expect(promedioDiario([300, 0, 0])).toBe(100);
  });

  it('es null si no hay días transcurridos', () => {
    expect(promedioDiario([null, null])).toBeNull();
    expect(promedioDiario([])).toBeNull();
  });
});
