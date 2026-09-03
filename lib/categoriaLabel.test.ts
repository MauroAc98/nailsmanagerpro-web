import { describe, expect, it } from 'vitest';
import { labelCategoriaGasto, labelCategoriaIngreso } from './categoriaLabel';

// `t` de mentira: devuelve la key marcada, así el test distingue "se pidió
// la traducción" de "se devolvió el texto verbatim".
const t = (key: string) => `t(${key})`;

describe('labelCategoriaGasto', () => {
  it('traduce las categorías de fábrica con la key category_<slug>', () => {
    expect(labelCategoriaGasto('insumos', t)).toBe('t(category_insumos)');
    expect(labelCategoriaGasto('servicios_publicos', t)).toBe('t(category_servicios_publicos)');
  });

  it('devuelve una categoría custom tal cual, sin tocar i18n', () => {
    expect(labelCategoriaGasto('Cursos y formación', t)).toBe('Cursos y formación');
    expect(labelCategoriaGasto('otros_gastos_raros', t)).toBe('otros_gastos_raros');
  });
});

describe('labelCategoriaIngreso', () => {
  it('traduce las categorías de fábrica con la key category_<slug>', () => {
    expect(labelCategoriaIngreso('venta_productos', t)).toBe('t(category_venta_productos)');
    expect(labelCategoriaIngreso('alquiler_espacio', t)).toBe('t(category_alquiler_espacio)');
  });

  it('devuelve una categoría custom tal cual, sin tocar i18n', () => {
    expect(labelCategoriaIngreso('Clases de uñas', t)).toBe('Clases de uñas');
  });
});
