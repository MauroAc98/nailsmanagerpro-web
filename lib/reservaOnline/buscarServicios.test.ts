import { describe, expect, it } from 'vitest';
import { coincide, normalizarBusqueda, partirPorCoincidencia } from './buscarServicios';

describe('normalizarBusqueda', () => {
  it('ignora mayúsculas, tildes y espacios de más', () => {
    expect(normalizarBusqueda('  LAMINADO de Pestañas ')).toBe('laminado de pestanas');
    expect(normalizarBusqueda('Depilación')).toBe('depilacion');
  });
});

describe('coincide', () => {
  it('encuentra por parte del nombre sin importar tildes ni mayúsculas', () => {
    expect(coincide('Laminado de pestañas', 'lamin')).toBe(true);
    expect(coincide('Laminado de pestañas', 'PESTANAS')).toBe(true);
    expect(coincide('Depilación facial', 'depilacion')).toBe(true);
  });

  it('no encuentra lo que no está', () => {
    expect(coincide('Perfilado', 'xyz')).toBe(false);
  });

  it('una búsqueda vacía o de solo espacios coincide con todo', () => {
    expect(coincide('Henna', '')).toBe(true);
    expect(coincide('Henna', '   ')).toBe(true);
  });
});

describe('partirPorCoincidencia', () => {
  it('marca la parte que coincide conservando el texto original (con tildes y mayúsculas)', () => {
    expect(partirPorCoincidencia('Laminado de pestañas', 'lam')).toEqual([
      { texto: 'Lam', coincide: true },
      { texto: 'inado de pestañas', coincide: false },
    ]);
    expect(partirPorCoincidencia('Depilación', 'depilacion')).toEqual([{ texto: 'Depilación', coincide: true }]);
  });

  it('marca la coincidencia aunque esté en el medio', () => {
    expect(partirPorCoincidencia('Laminado de pestañas', 'pesta')).toEqual([
      { texto: 'Laminado de ', coincide: false },
      { texto: 'pesta', coincide: true },
      { texto: 'ñas', coincide: false },
    ]);
  });

  it('sin coincidencia o sin búsqueda devuelve el texto entero sin marcar', () => {
    expect(partirPorCoincidencia('Henna', 'xyz')).toEqual([{ texto: 'Henna', coincide: false }]);
    expect(partirPorCoincidencia('Henna', '')).toEqual([{ texto: 'Henna', coincide: false }]);
  });
});
