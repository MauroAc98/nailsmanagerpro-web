import { describe, expect, it } from 'vitest';
import {
  medirTextoServicios,
  serviciosEntran,
  tituloFiltroServicios,
} from './historiaServicios';

const categorias = [
  { id: 1, nombre: 'Uñas' },
  { id: 2, nombre: 'Pestañas' },
  { id: 3, nombre: 'Cejas' },
];

describe('tituloFiltroServicios', () => {
  it('una sola categoría: su nombre', () => {
    expect(tituloFiltroServicios([{ categoria_id: 1 }, { categoria_id: 1 }], categorias)).toBe('Uñas');
  });

  it('dos categorías: unidas con " y "', () => {
    expect(tituloFiltroServicios([{ categoria_id: 2 }, { categoria_id: 1 }], categorias)).toBe('Uñas y Pestañas');
  });

  it('tres categorías: orden de categorías, comas y la última con " y "', () => {
    const r = tituloFiltroServicios([{ categoria_id: 3 }, { categoria_id: 2 }, { categoria_id: 1 }], categorias);
    expect(r).toBe('Uñas, Pestañas y Cejas');
  });

  it('ignora los servicios sin categoría', () => {
    expect(tituloFiltroServicios([{ categoria_id: null }, { categoria_id: 3 }], categorias)).toBe('Cejas');
  });

  it('sin ninguna categoría: "Servicios"', () => {
    expect(tituloFiltroServicios([{ categoria_id: null }], categorias)).toBe('Servicios');
    expect(tituloFiltroServicios([], categorias)).toBe('Servicios');
  });

  it('una categoría desconocida cuenta como sin categoría', () => {
    expect(tituloFiltroServicios([{ categoria_id: 99 }], categorias)).toBe('Servicios');
  });
});

describe('serviciosEntran', () => {
  const medir = (t: string) => t.length * 6;

  it('lista vacía entra', () => {
    expect(serviciosEntran([], 2, 100, medir)).toBe(true);
  });

  it('entra en una línea', () => {
    expect(serviciosEntran(['Esmaltado', 'Kapping'], 2, 300, medir)).toBe(true);
  });

  it('entra en dos líneas', () => {
    // "AAAAAAAAAA" = 60 px; con " ·  " (24) -> dos nombres = 144 > 100.
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 2, 100, medir)).toBe(true);
  });

  it('necesita tres líneas', () => {
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 100, medir)).toBe(false);
  });

  it('un nombre más ancho que la línea no entra', () => {
    expect(serviciosEntran(['A'.repeat(30)], 2, 100, medir)).toBe(false);
  });

  it('cuenta el separador entre nombres de la misma línea', () => {
    // 2 x 60 + 24 = 144 entra justo en 144, no en 143 (pero sí en 2 líneas).
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 144, medir)).toBe(true);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 143, medir)).toBe(false);
  });
  it('con máximo 1 línea, lo que pide dos líneas no entra', () => {
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 100, medir)).toBe(false);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 144, medir)).toBe(true);
  });
});

describe('medirTextoServicios', () => {
  it('mide la bajada en mayúsculas con su espaciado (sin canvas 2D usa un fallback)', () => {
    // 4 letras: 6px cada una + 1.3px de espaciado por letra.
    expect(medirTextoServicios('abcd')).toBeCloseTo(29.2);
    expect(medirTextoServicios('')).toBe(0);
  });

  it('mide igual en minúsculas que en mayúsculas (la bajada va en mayúsculas)', () => {
    expect(medirTextoServicios('Cavado')).toBe(medirTextoServicios('CAVADO'));
  });
});
