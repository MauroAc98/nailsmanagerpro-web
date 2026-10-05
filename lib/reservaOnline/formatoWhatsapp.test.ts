import { describe, expect, it } from 'vitest';
import { formatearWhatsapp } from './formatoWhatsapp';

describe('formatearWhatsapp', () => {
  it('Argentina, area de 3 digitos: +54 9 376 479-4897', () => {
    expect(formatearWhatsapp('+5493764794897')).toBe('+54 9 376 479-4897');
  });
  it('Argentina, area 11 (2 digitos): +54 9 11 5555-1234', () => {
    expect(formatearWhatsapp('+5491155551234')).toBe('+54 9 11 5555-1234');
  });
  it('Argentina con digitos de mas o de menos: agrupa sin perder ninguno', () => {
    expect(formatearWhatsapp('+549376479489').replace(/\D/g, '')).toBe('549376479489');
    expect(formatearWhatsapp('+54937647948977').replace(/\D/g, '')).toBe('54937647948977');
  });
  it('otros paises: +codigo y el resto agrupado', () => {
    expect(formatearWhatsapp('+5511987654321')).toBe('+55 119 876 543 21');
    expect(formatearWhatsapp('+59899123456')).toBe('+598 991 234 56');
  });
  it('nunca pierde digitos', () => {
    for (const n of ['+5511987654321', '+59899123456', '+15551234567']) {
      expect(formatearWhatsapp(n).replace(/\D/g, '')).toBe(n.replace(/\D/g, ''));
    }
  });
  it('vacio devuelve vacio', () => {
    expect(formatearWhatsapp('')).toBe('');
  });
});
