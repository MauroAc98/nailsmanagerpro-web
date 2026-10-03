import { describe, expect, it } from 'vitest';
import { elegirFotoEncabezado } from './fotoEncabezado';

const natalia = { id: 1, avatar_url: 'https://cdn/natalia.jpg' };
const gabriela = { id: 2, avatar_url: null };
const logo = 'https://cdn/logo.png';

describe('elegirFotoEncabezado', () => {
  it('sin profesional tildada usa el logo del negocio', () => {
    expect(elegirFotoEncabezado([natalia, gabriela], null, logo)).toBe(logo);
  });

  it('con una profesional tildada que tiene avatar usa ese avatar', () => {
    expect(elegirFotoEncabezado([natalia, gabriela], 1, logo)).toBe('https://cdn/natalia.jpg');
  });

  it('con una profesional tildada sin avatar sigue usando el logo del negocio', () => {
    expect(elegirFotoEncabezado([natalia, gabriela], 2, logo)).toBe(logo);
  });

  it('si el id tildado no está en la lista cae al logo', () => {
    expect(elegirFotoEncabezado([natalia], 99, logo)).toBe(logo);
  });

  it('sin logo ni avatar devuelve null', () => {
    expect(elegirFotoEncabezado([gabriela], 2, null)).toBeNull();
  });

  it('con avatar y sin logo usa el avatar', () => {
    expect(elegirFotoEncabezado([natalia], 1, null)).toBe('https://cdn/natalia.jpg');
  });

  it('un avatar vacío cuenta como sin avatar', () => {
    expect(elegirFotoEncabezado([{ id: 3, avatar_url: '' }], 3, logo)).toBe(logo);
  });
});
