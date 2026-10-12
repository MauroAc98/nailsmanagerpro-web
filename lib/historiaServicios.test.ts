import { describe, expect, it } from 'vitest';
import {
  medirEtiquetaCategoria,
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
    // "AAAAAAAAAA" = 60 px; con " / " (18) -> dos nombres = 138 > 100.
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 2, 100, medir)).toBe(true);
  });

  it('necesita tres líneas', () => {
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 100, medir)).toBe(false);
  });

  it('un nombre más ancho que la línea no entra', () => {
    expect(serviciosEntran(['A'.repeat(30)], 2, 100, medir)).toBe(false);
  });

  it('cuenta el separador entre nombres de la misma línea', () => {
    // 2 x 60 + 18 = 138 entra justo en 138, no en 137 (pero sí en 2 líneas).
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 138, medir)).toBe(true);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC'], 2, 137, medir)).toBe(false);
  });
  it('con máximo 1 línea, lo que pide dos líneas no entra', () => {
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 100, medir)).toBe(false);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 138, medir)).toBe(true);
  });
});

describe('serviciosEntran con la etiqueta de la categoría al principio', () => {
  const medir = (t: string) => t.length * 6;

  it('la etiqueta ocupa lugar en el primer renglón', () => {
    // 2 nombres de 60 + separador 18 = 138: sin etiqueta entra en 1 renglón de 140.
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 140, medir)).toBe(true);
    // Con una etiqueta de 40 ya no entra en 1 renglón, pero sí en 2.
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 1, 140, medir, 40)).toBe(false);
    expect(serviciosEntran(['AAAAAAAAAA', 'BBBBBBBBBB'], 2, 140, medir, 40)).toBe(true);
  });

  it('si el primer nombre no entra al lado de la etiqueta, baja al segundo renglón', () => {
    expect(serviciosEntran(['AAAAAAAAAA'], 1, 100, medir, 60)).toBe(false);
    expect(serviciosEntran(['AAAAAAAAAA'], 2, 100, medir, 60)).toBe(true);
  });
});

describe('medirEtiquetaCategoria', () => {
  it('sin canvas 2D usa un fallback que incluye relleno y separación', () => {
    expect(medirEtiquetaCategoria('ABCD')).toBeGreaterThan(medirTextoServicios('ABCD'));
    expect(medirEtiquetaCategoria('')).toBeGreaterThan(0);
  });
});

describe('medirTextoServicios', () => {
  it('sin canvas 2D (jsdom) usa el fallback proporcional al largo', () => {
    expect(medirTextoServicios('abcd')).toBe(24);
    expect(medirTextoServicios('')).toBe(0);
  });

});
