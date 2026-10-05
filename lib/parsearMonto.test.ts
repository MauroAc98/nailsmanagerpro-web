import { describe, expect, it } from 'vitest';
import { parsearMonto } from './parsearMonto';

describe('parsearMonto', () => {
  it.each([
    ['1500', 1500],
    ['1.500', 1500],
    ['12.500', 12500],
    ['1.234.567', 1234567],
    ['1.500,50', 1500.5],
    ['150,5', 150.5],
    ['150,50', 150.5],
    ['150.50', 150.5],
    ['0', 0],
    ['  2000 ', 2000],
  ])('%s -> %s', (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it.each(['', ' ', 'abc', '1,500', '150,', '150.', '-5', '1.5.0', '1..500', '12.34.5', '1e3'])(
    'rechaza %j',
    (texto) => {
      expect(parsearMonto(texto)).toBeNull();
    },
  );
});
