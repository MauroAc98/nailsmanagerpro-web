import { describe, expect, it } from 'vitest';
import {
  normalizarCategoria,
  agregarCategoria,
  renombrarCategoria,
  eliminarCategoria,
  MAX_CATEGORIAS,
} from './categoriasMovimiento';

describe('normalizarCategoria', () => {
  it('recorta extremos y colapsa espacios interiores', () => {
    expect(normalizarCategoria('  Servicios   públicos  ')).toBe('Servicios públicos');
  });
});

describe('agregarCategoria', () => {
  it('agrega la categoría normalizada al final', () => {
    expect(agregarCategoria(['insumos'], '  Marketing ')).toEqual({ ok: true, categorias: ['insumos', 'Marketing'] });
  });

  it('rechaza un nombre vacío', () => {
    expect(agregarCategoria(['insumos'], '   ')).toEqual({ ok: false, error: 'vacia' });
  });

  it('rechaza un duplicado ignorando mayúsculas', () => {
    expect(agregarCategoria(['Insumos'], 'insumos')).toEqual({ ok: false, error: 'duplicada' });
  });

  it('rechaza un nombre de más de 40 caracteres', () => {
    expect(agregarCategoria([], 'x'.repeat(41))).toEqual({ ok: false, error: 'muyLarga' });
  });

  it('rechaza pasar del máximo de categorías', () => {
    const llena = Array.from({ length: MAX_CATEGORIAS }, (_, i) => `c${i}`);
    expect(agregarCategoria(llena, 'otra')).toEqual({ ok: false, error: 'limite' });
  });
});

describe('renombrarCategoria', () => {
  it('renombra el ítem del índice dado', () => {
    expect(renombrarCategoria(['insumos', 'otros'], 0, 'Insumos y materiales')).toEqual({
      ok: true,
      categorias: ['Insumos y materiales', 'otros'],
    });
  });

  it('permite "renombrar" un ítem a su mismo valor (no cuenta como duplicado)', () => {
    expect(renombrarCategoria(['insumos', 'otros'], 0, 'insumos')).toEqual({
      ok: true,
      categorias: ['insumos', 'otros'],
    });
  });

  it('rechaza chocar con otra categoría existente', () => {
    expect(renombrarCategoria(['insumos', 'otros'], 0, 'otros')).toEqual({ ok: false, error: 'duplicada' });
  });
});

describe('eliminarCategoria', () => {
  it('elimina el ítem del índice dado', () => {
    expect(eliminarCategoria(['insumos', 'otros'], 0)).toEqual({ ok: true, categorias: ['otros'] });
  });

  it('no deja borrar la última categoría', () => {
    expect(eliminarCategoria(['insumos'], 0)).toEqual({ ok: false, error: 'minima' });
  });
});
