import { describe, expect, it } from 'vitest';
import { formatearRestante } from './cuentaRegresiva';

describe('formatearRestante', () => {
  it('mm:ss con ceros a la izquierda', () => {
    expect(formatearRestante(14 * 60_000 + 59_000)).toBe('14:59');
    expect(formatearRestante(5_000)).toBe('00:05');
  });
  it('redondea hacia arriba los milisegundos sueltos y nunca es negativo', () => {
    expect(formatearRestante(1)).toBe('00:01');
    expect(formatearRestante(-500)).toBe('00:00');
  });
});
