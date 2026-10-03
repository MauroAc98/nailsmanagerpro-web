import { describe, expect, it } from 'vitest';
import { rangoMesAnterior, ticketPromedio, variacionPorcentual } from './metricas';

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
