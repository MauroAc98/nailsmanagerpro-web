import { describe, expect, it } from 'vitest';
import { coincideConPorcentaje, COMISIONES_MP_REFERENCIA, porcentajeParaInput } from './mpComisiones';

describe('mpComisiones', () => {
  it('lists the four MP plazos with the reference rates', () => {
    expect(COMISIONES_MP_REFERENCIA.map(c => c.porcentaje)).toEqual([6.29, 4.39, 3.39, 1.49]);
  });

  it('formats with decimal comma', () => {
    expect(porcentajeParaInput(4.39)).toBe('4,39');
  });

  it('matches input text with comma or dot, never an empty one', () => {
    expect(coincideConPorcentaje('4,39', 4.39)).toBe(true);
    expect(coincideConPorcentaje('4.39', 4.39)).toBe(true);
    expect(coincideConPorcentaje('4,4', 4.39)).toBe(false);
    expect(coincideConPorcentaje('', 4.39)).toBe(false);
  });
});
