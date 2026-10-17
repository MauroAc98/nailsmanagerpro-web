import { describe, expect, it } from 'vitest';
import { aDateLocal, diasDeSemana, sumarDias } from './semana';

describe('sumarDias', () => {
  it('suma y resta días cruzando mes y año', () => {
    expect(sumarDias('2026-10-17', 7)).toBe('2026-10-24');
    expect(sumarDias('2026-10-28', 7)).toBe('2026-11-04');
    expect(sumarDias('2026-01-03', -7)).toBe('2025-12-27');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('diasDeSemana', () => {
  it('devuelve lunes a domingo de la semana que contiene la fecha', () => {
    // 2026-10-17 es sábado.
    expect(diasDeSemana('2026-10-17')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
  });

  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    expect(diasDeSemana('2026-10-18')[0]).toBe('2026-10-12');
    expect(diasDeSemana('2026-10-12')[0]).toBe('2026-10-12');
  });

  it('cruza de mes y de año', () => {
    expect(diasDeSemana('2026-12-31')[0]).toBe('2026-12-28');
    expect(diasDeSemana('2026-12-31')[6]).toBe('2027-01-03');
  });
});

describe('aDateLocal', () => {
  it('arma la fecha local sin pasar por UTC', () => {
    const d = aDateLocal('2026-10-17');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 17, 0]);
  });
});
