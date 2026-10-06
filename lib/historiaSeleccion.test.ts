import { describe, expect, it } from 'vitest';
import type { Servicio } from '@/services/servicioService';
import type { CategoriaServicio } from '@/services/categoriaServicioService';
import {
  agruparParaSeleccion,
  contarSeleccionados,
  filtrarPorSeleccion,
  quitarTodo,
  seleccionarTodo,
  toggleCategoria,
  toggleServicio,
} from './historiaSeleccion';

function servicio(overrides: Partial<Servicio>): Servicio {
  return {
    id: 1, user_id: 1, nombre: 'Servicio', duracion_minutos: 30, precio: '100',
    activo: true, es_promo: false, orden: 0, categoria_id: null,
    created_at: '', updated_at: '', ...overrides,
  };
}
const categoria = (id: number, nombre: string) => ({ id, nombre }) as CategoriaServicio;

const categorias = [categoria(10, 'Uñas'), categoria(20, 'Pies'), categoria(30, 'Vacía')];
const servicios = [
  servicio({ id: 1, categoria_id: 10 }),
  servicio({ id: 2, categoria_id: 10 }),
  servicio({ id: 3, categoria_id: 20 }),
  servicio({ id: 4, categoria_id: null }),
];

describe('agruparParaSeleccion', () => {
  it('agrupa por categoría, "Sin categoría" al final y oculta categorías vacías', () => {
    const grupos = agruparParaSeleccion(servicios, categorias, new Set());
    expect(grupos.map(g => g.id)).toEqual([10, 20, null]);
  });

  it('con nada excluido todo está marcado (estado all)', () => {
    const grupos = agruparParaSeleccion(servicios, categorias, new Set());
    expect(grupos.map(g => [g.marcados, g.total, g.estado])).toEqual([
      [2, 2, 'all'], [1, 1, 'all'], [1, 1, 'all'],
    ]);
  });

  it('calcula none / some / all según los excluidos', () => {
    const grupos = agruparParaSeleccion(servicios, categorias, new Set([1, 3]));
    expect(grupos.map(g => [g.marcados, g.total, g.estado])).toEqual([
      [1, 2, 'some'], [0, 1, 'none'], [1, 1, 'all'],
    ]);
  });
});

describe('toggleServicio', () => {
  it('excluye un servicio incluido y lo vuelve a incluir', () => {
    const uno = toggleServicio(new Set(), 2);
    expect([...uno]).toEqual([2]);
    expect([...toggleServicio(uno, 2)]).toEqual([]);
  });

  it('no muta el set original', () => {
    const original = new Set<number>();
    toggleServicio(original, 1);
    expect(original.size).toBe(0);
  });
});

describe('toggleCategoria', () => {
  it('con estado all excluye todos los de la categoría', () => {
    expect([...toggleCategoria(new Set([9]), [1, 2], 'all')].sort()).toEqual([1, 2, 9]);
  });

  it('con estado some incluye todos los de la categoría', () => {
    expect([...toggleCategoria(new Set([1, 9]), [1, 2], 'some')]).toEqual([9]);
  });

  it('con estado none incluye todos los de la categoría', () => {
    expect([...toggleCategoria(new Set([1, 2]), [1, 2], 'none')]).toEqual([]);
  });
});

describe('seleccionarTodo / quitarTodo', () => {
  it('seleccionarTodo no excluye nada', () => {
    expect(seleccionarTodo().size).toBe(0);
  });

  it('quitarTodo excluye todos los ids dados', () => {
    expect([...quitarTodo(servicios)].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('filtrarPorSeleccion / contarSeleccionados', () => {
  it('conserva solo los no excluidos, en el mismo orden', () => {
    expect(filtrarPorSeleccion(servicios, new Set([2, 4])).map(s => s.id)).toEqual([1, 3]);
  });

  it('un servicio nuevo (id no excluido) entra por defecto', () => {
    const nuevo = servicio({ id: 99 });
    expect(filtrarPorSeleccion([...servicios, nuevo], new Set([1])).map(s => s.id)).toContain(99);
  });

  it('cuenta los seleccionados', () => {
    expect(contarSeleccionados(servicios, new Set([1, 2]))).toBe(2);
  });
});
