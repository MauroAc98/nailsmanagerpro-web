import { describe, expect, it } from 'vitest';
import { nombreYaEnNegocio } from './nombreEnNegocio';

describe('nombreYaEnNegocio', () => {
  it('true cuando el nombre del negocio contiene el nombre de la profesional', () => {
    expect(nombreYaEnNegocio('Natalia', 'Natalia Acosta Studio')).toBe(true);
  });

  it('false cuando es otra profesional', () => {
    expect(nombreYaEnNegocio('Gabriela', 'Natalia Acosta Studio')).toBe(false);
  });

  it('ignora mayúsculas y acentos', () => {
    expect(nombreYaEnNegocio('maría', 'MARIA Nails')).toBe(true);
    expect(nombreYaEnNegocio('Maria', 'María Nails')).toBe(true);
  });

  it('solo cuenta palabras completas, no pedazos de otra palabra', () => {
    expect(nombreYaEnNegocio('Ana', 'Banana Nails')).toBe(false);
    expect(nombreYaEnNegocio('Ana', 'Ana Nails')).toBe(true);
  });

  it('con nombre compuesto exige todas las palabras', () => {
    expect(nombreYaEnNegocio('Ana Paula', 'Studio Ana Paula')).toBe(true);
    expect(nombreYaEnNegocio('Ana Paula', 'Studio Ana')).toBe(false);
  });

  it('nombre igual al del negocio cuenta como ya presente', () => {
    expect(nombreYaEnNegocio('Turnetto', 'Turnetto')).toBe(true);
  });

  it('false con valores vacíos o ausentes', () => {
    expect(nombreYaEnNegocio('', 'Natalia Studio')).toBe(false);
    expect(nombreYaEnNegocio('Natalia', '')).toBe(false);
    expect(nombreYaEnNegocio(undefined, 'Natalia Studio')).toBe(false);
    expect(nombreYaEnNegocio('Natalia', null)).toBe(false);
  });
});
