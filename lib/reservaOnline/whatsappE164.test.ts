import { describe, expect, it } from 'vitest';
import { esWhatsappE164, normalizarWhatsappE164 } from './whatsappE164';

describe('esWhatsappE164', () => {
  it('acepta un numero AR valido con +', () => {
    expect(esWhatsappE164('+5491155551234')).toBe(true);
  });

  it('acepta otros paises (+55, +598)', () => {
    expect(esWhatsappE164('+5511987654321')).toBe(true);
    expect(esWhatsappE164('+59899123456')).toBe(true);
  });

  it('rechaza numeros sin + o cortos', () => {
    expect(esWhatsappE164('1155')).toBe(false);
    expect(esWhatsappE164('5491155551234')).toBe(false);
    expect(esWhatsappE164('+1155')).toBe(false);
  });

  it('rechaza letras, vacio y cero inicial', () => {
    expect(esWhatsappE164('')).toBe(false);
    expect(esWhatsappE164('+54abc55551234')).toBe(false);
    expect(esWhatsappE164('+0491155551234')).toBe(false);
  });

  it('rechaza mas de 15 digitos', () => {
    expect(esWhatsappE164('+1234567890123456')).toBe(false);
  });
});

describe('normalizarWhatsappE164', () => {
  it('saca espacios, guiones y parentesis', () => {
    expect(normalizarWhatsappE164('+54 9 11 5555-1234')).toBe('+5491155551234');
    expect(normalizarWhatsappE164(' +54 (9) 11 5555 1234 ')).toBe('+5491155551234');
  });

  it('no inventa el +: sin prefijo queda sin prefijo', () => {
    expect(normalizarWhatsappE164('11 5555-1234')).toBe('1155551234');
  });
});
