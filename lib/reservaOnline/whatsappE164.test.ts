import { describe, expect, it } from 'vitest';
import { esWhatsappE164, localDeWhatsapp, normalizarWhatsappE164, whatsappArgentino } from './whatsappE164';

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

describe('whatsappArgentino (prefijo fijo +54 9)', () => {
  it('antepone +54 9 al numero local tipeado, sin separadores', () => {
    expect(whatsappArgentino('376 512-3456')).toBe('+5493765123456');
  });
  it('si la clienta pega el numero completo no duplica el prefijo', () => {
    expect(whatsappArgentino('+54 9 376 512 3456')).toBe('+5493765123456');
    expect(whatsappArgentino('+5493765123456')).toBe('+5493765123456');
  });
  it('descarta el 0 inicial del codigo de area', () => {
    expect(whatsappArgentino('0376 512 3456')).toBe('+5493765123456');
  });
  it('sin digitos devuelve vacio (el campo queda vacio, no "+549")', () => {
    expect(whatsappArgentino('')).toBe('');
    expect(whatsappArgentino(' - ')).toBe('');
  });
  it('el resultado se valida con esWhatsappE164', () => {
    expect(esWhatsappE164(whatsappArgentino('11 5555 1234'))).toBe(true);
    expect(esWhatsappE164(whatsappArgentino('1155'))).toBe(false);
  });
});

describe('localDeWhatsapp', () => {
  it('quita el prefijo +54 9 para volver a mostrar el numero local', () => {
    expect(localDeWhatsapp('+5493765123456')).toBe('3765123456');
  });
  it('un valor que no es +549 se muestra tal cual', () => {
    expect(localDeWhatsapp('+5511987654321')).toBe('+5511987654321');
    expect(localDeWhatsapp('')).toBe('');
  });
});
