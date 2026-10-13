import { describe, expect, it } from 'vitest';
import {
  medirTextoServicios,
  repartirEnRenglones,
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
    // "AAAAAAAAAA" = 60 px; con el separador (16) -> dos nombres = 136 > 100.
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 2, 100, medir)).toBe(true);
  });

  it('necesita tres líneas', () => {
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 100, medir)).toBe(false);
  });

  it('un nombre más ancho que la línea no entra', () => {
    expect(serviciosEntran(['A'.repeat(30)], 2, 100, medir)).toBe(false);
  });

  it('cuenta el separador entre nombres de la misma línea', () => {
    // 2 x 60 + 16 = 136 entra justo en 136, no en 135 (pero sí en 2 líneas).
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 136, medir)).toBe(true);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 135, medir)).toBe(false);
  });
  it('con máximo 1 línea, lo que pide dos líneas no entra', () => {
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 100, medir)).toBe(false);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 136, medir)).toBe(true);
  });
});

describe('repartirEnRenglones', () => {
  const medir = (t: string) => t.length * 6;

  it('arma los renglones con los nombres de cada uno (el separador solo va entre nombres del mismo renglón)', () => {
    // Ancho 90: "AAAAAAAAAA" (60) + separador (16) + "BBB" (18) = 94 > 90 -> baja.
    expect(repartirEnRenglones(['AAAAAAAAAA', 'BBB', 'CC'], 90, medir)).toEqual([['AAAAAAAAAA'], ['BBB', 'CC']]);
  });

  it('lista vacía: sin renglones', () => {
    expect(repartirEnRenglones([], 100, medir)).toEqual([]);
  });
});

describe('medirTextoServicios', () => {
  it('mide la bajada tal cual se escribe (sin canvas 2D usa un fallback con margen)', () => {
    // 4 letras: 5.5px cada una, más el 3% de margen por la serif más ancha.
    expect(medirTextoServicios('abcd')).toBeCloseTo(22 * 1.03);
    expect(medirTextoServicios('')).toBe(0);
  });

  it('no agrega espaciado por letra: el ancho crece en proporción al largo', () => {
    expect(medirTextoServicios('abcdabcd')).toBeCloseTo(2 * medirTextoServicios('abcd'));
  });
});
