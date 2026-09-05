import { describe, expect, it } from 'vitest';
import { agruparServiciosPorCategoria } from '@/lib/agruparServiciosPorCategoria';
import { Servicio } from '@/services/servicioService';
import { CategoriaServicio } from '@/services/categoriaServicioService';

// `orden` restarts at 0 per (categoria, es_promo) group on the backend, so
// merging regulars and promos into one flat list (Slice B) makes
// cross-group ties visible. `id` is the deterministic tiebreak — see
// design D "lib/agruparServiciosPorCategoria.ts (modify)".

function servicio(overrides: Partial<Servicio>): Servicio {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Servicio',
    duracion_minutos: 30,
    precio: null,
    activo: true,
    es_promo: false,
    orden: 0,
    categoria_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function categoria(id: number, nombre: string): CategoriaServicio {
  return { id, nombre, user_id: 1, created_at: '', updated_at: '' } as CategoriaServicio;
}

describe('agruparServiciosPorCategoria', () => {
  it('en un empate de orden, el servicio con id menor va primero (tiebreak determinístico)', () => {
    // Regular (orden:0, id:20) y promo (orden:0, id:21) de la MISMA
    // categoría, empatados en orden — sin el tiebreak por id, el orden de
    // salida dependería del orden de inserción del array de entrada, no de
    // una regla estable.
    const categorias = [categoria(1, 'Manicura')];
    const servicios = [
      servicio({ id: 21, orden: 0, categoria_id: 1, es_promo: true }),
      servicio({ id: 20, orden: 0, categoria_id: 1, es_promo: false }),
    ];

    const grupos = agruparServiciosPorCategoria(servicios, categorias);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].servicios.map(s => s.id)).toEqual([20, 21]);
  });

  it('orden distinto sigue mandando por sobre el id (el tiebreak solo aplica en empate)', () => {
    const categorias = [categoria(1, 'Manicura')];
    const servicios = [
      servicio({ id: 5, orden: 1, categoria_id: 1 }),
      servicio({ id: 99, orden: 0, categoria_id: 1 }),
    ];

    const grupos = agruparServiciosPorCategoria(servicios, categorias);

    expect(grupos[0].servicios.map(s => s.id)).toEqual([99, 5]);
  });

  it('no muta el array de entrada', () => {
    const categorias = [categoria(1, 'Manicura')];
    const servicios = [
      servicio({ id: 21, orden: 0, categoria_id: 1 }),
      servicio({ id: 20, orden: 0, categoria_id: 1 }),
    ];
    const snapshot = [...servicios];

    agruparServiciosPorCategoria(servicios, categorias);

    expect(servicios).toEqual(snapshot);
    expect(servicios.map(s => s.id)).toEqual([21, 20]);
  });

  it('el grupo "Sin categoría" siempre queda al final', () => {
    const categorias = [categoria(1, 'Manicura'), categoria(2, 'Pedicura')];
    const servicios = [
      servicio({ id: 1, categoria_id: null }),
      servicio({ id: 2, categoria_id: 2 }),
      servicio({ id: 3, categoria_id: 1 }),
    ];

    const grupos = agruparServiciosPorCategoria(servicios, categorias);

    expect(grupos.map(g => g.id)).toEqual([1, 2, null]);
  });

  it('el tiebreak también aplica al grupo "Sin categoría"', () => {
    const categorias: CategoriaServicio[] = [];
    const servicios = [
      servicio({ id: 8, orden: 0, categoria_id: null }),
      servicio({ id: 7, orden: 0, categoria_id: null }),
    ];

    const grupos = agruparServiciosPorCategoria(servicios, categorias);

    expect(grupos[0].id).toBeNull();
    expect(grupos[0].servicios.map(s => s.id)).toEqual([7, 8]);
  });

  it('categorías sin servicios asignados no generan grupo', () => {
    const categorias = [categoria(1, 'Manicura'), categoria(2, 'Vacía')];
    const servicios = [servicio({ id: 1, categoria_id: 1 })];

    const grupos = agruparServiciosPorCategoria(servicios, categorias);

    expect(grupos.map(g => g.id)).toEqual([1]);
  });
});
