import { describe, expect, it } from 'vitest';
import type { Servicio } from '@/services/servicioService';
import type { CategoriaServicio } from '@/services/categoriaServicioService';
import { armarHistorias, nombreArchivoHistoria } from './historiaHistorias';

function servicio(overrides: Partial<Servicio>): Servicio {
  return {
    id: 1, user_id: 1, nombre: 'Servicio', duracion_minutos: 30, precio: '100',
    activo: true, es_promo: false, orden: 0, categoria_id: null,
    created_at: '', updated_at: '', ...overrides,
  };
}
const categorias = [{ id: 10, nombre: 'Uñas' }, { id: 20, nombre: 'Pies' }] as CategoriaServicio[];
const servicios = [
  servicio({ id: 1, nombre: 'Esmaltado', categoria_id: 10, orden: 1 }),
  servicio({ id: 2, nombre: 'Pedicura', categoria_id: 20, orden: 0 }),
  servicio({ id: 3, nombre: 'Cejas', categoria_id: null, orden: 2 }),
  servicio({ id: 4, nombre: 'Kapping', categoria_id: 10, orden: 0 }),
];

describe('armarHistorias', () => {
  it('modo "una": una sola historia sin título con todos los servicios en el orden recibido', () => {
    const h = armarHistorias(servicios, 'una', categorias);
    expect(h).toHaveLength(1);
    expect(h[0].titulo).toBeNull();
    expect(h[0].servicios.map(s => s.id)).toEqual([1, 2, 3, 4]);
  });

  it('modo "una" sin servicios: no hay historias', () => {
    expect(armarHistorias([], 'una', categorias)).toEqual([]);
  });

  it('modo "categoria": una por categoría con servicios, en el orden de categorías y "Sin categoría" al final', () => {
    const h = armarHistorias(servicios, 'categoria', categorias);
    expect(h.map(x => x.titulo)).toEqual(['Uñas', 'Pies', 'Sin categoría']);
    expect(h.map(x => x.servicios.map(s => s.id))).toEqual([[4, 1], [2], [3]]);
  });

  it('modo "categoria": omite categorías sin servicios elegidos y ids son únicos', () => {
    const h = armarHistorias([servicios[1]], 'categoria', categorias);
    expect(h.map(x => x.titulo)).toEqual(['Pies']);
    const todas = armarHistorias(servicios, 'categoria', categorias);
    expect(new Set(todas.map(x => x.id)).size).toBe(3);
  });

  it('modo "categoria" sin servicios: no hay historias', () => {
    expect(armarHistorias([], 'categoria', categorias)).toEqual([]);
  });

  it('permite traducir el título de "Sin categoría"', () => {
    const h = armarHistorias([servicios[2]], 'categoria', categorias, 'Sem categoria');
    expect(h[0].titulo).toBe('Sem categoria');
  });
});

describe('nombreArchivoHistoria', () => {
  it('sin título usa el nombre histórico', () => {
    expect(nombreArchivoHistoria(null)).toBe('historia-precios.png');
  });
  it('con categoría agrega un slug sin tildes ni símbolos', () => {
    expect(nombreArchivoHistoria('Uñas & Pies')).toBe('historia-precios-unas-pies.png');
  });
  it('un título sin caracteres útiles cae al nombre histórico', () => {
    expect(nombreArchivoHistoria('***')).toBe('historia-precios.png');
  });
});
