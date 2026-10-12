import { describe, expect, it } from 'vitest';
import { repartirFilas } from './repartoFilas';

describe('repartirFilas', () => {
  it('con alto de sobra el espacio entre filas no pasa de 20px', () => {
    expect(repartirFilas(500, 7)).toEqual({ gap: 20, altoFila: 14 });
  });

  it('reparte el alto sobrante entre las filas', () => {
    // 16 filas de 14 = 224; quedan 96 para 15 espacios = 6.4.
    const r = repartirFilas(320, 16);
    expect(r.altoFila).toBe(14);
    expect(r.gap).toBeCloseTo(6.4);
    expect(16 * r.altoFila + 15 * (r.gap ?? 0)).toBeCloseTo(320);
  });

  it('si con el espacio mínimo no alcanza, achica las filas y siempre entra', () => {
    const r = repartirFilas(220, 16);
    expect(r.gap).toBe(2);
    expect(r.altoFila).toBeLessThan(14);
    expect(16 * r.altoFila + 15 * (r.gap ?? 0)).toBeLessThanOrEqual(220);
  });

  it('las filas nunca bajan de 10px aunque no haya alto', () => {
    expect(repartirFilas(50, 16).altoFila).toBe(10);
  });

  it('sin alto medido (0) usa el diseño de siempre', () => {
    expect(repartirFilas(0, 16)).toEqual({ gap: null, altoFila: 14 });
  });

  it('una sola fila no tiene espacios', () => {
    expect(repartirFilas(300, 1)).toEqual({ gap: 20, altoFila: 14 });
  });
});
