import { describe, expect, it } from 'vitest';
import { diasDesde, sumarDias } from './diasDesde';

describe('sumarDias', () => {
  it('suma dentro del mes', () => {
    expect(sumarDias('2026-09-19', 3)).toBe('2026-09-22');
  });

  it('cruza fin de mes y de anio', () => {
    expect(sumarDias('2026-09-29', 3)).toBe('2026-10-02');
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('respeta anio bisiesto', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('diasDesde', () => {
  it('genera n dias consecutivos incluyendo el inicial', () => {
    expect(diasDesde('2026-09-19', 3)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21']);
  });

  it('n = 0 devuelve lista vacia', () => {
    expect(diasDesde('2026-09-19', 0)).toEqual([]);
  });
});
