import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useHistoriaPrecios } from './useHistoriaPrecios';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import type { Profesional } from '@/services/profesionalService';
import type { Servicio } from '@/services/servicioService';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import type { CategoriaServicio } from '@/services/categoriaServicioService';

function servicio(overrides: Partial<Servicio>): Servicio {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Servicio',
    duracion_minutos: 30,
    precio: '100',
    activo: true,
    es_promo: false,
    orden: 0,
    categoria_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

function profesional(overrides: Partial<Profesional>): Profesional {
  return {
    id: 1,
    user_id: 1,
    nombre: 'Jefa',
    apellido: null,
    nombre_completo: 'Jefa',
    color: null,
    activo: true,
    servicios: [],
    fondo_historia_url: null,
    avatar_url: null,
    historia_precios_template_id: null,
    historia_precios_fotos: [],
    historia_precios_nota: null,
    dias_atencion: null,
    ...overrides,
  };
}

// reordenarEnSitio (lib/reordenarEnSitio.ts) deja los ítems afectados en su
// posición ORIGINAL del array del store, actualizando solo su campo `orden`
// — no reordena el array en sí. Cualquier consumidor que confíe en el orden
// crudo del array (en vez de ordenar por `.orden`) muestra la posición
// vieja, previa al drag, aunque `orden` ya esté actualizado. Este es
// exactamente el bug reportado: arrastrar en Servicios no movía la posición
// en Historia de Precios.
describe('useHistoriaPrecios.serviciosActivos', () => {
  beforeEach(() => {
    useProfesionalStore.setState({ profesionales: [] });
    useServiciosStore.setState({ servicios: [] });
  });

  it('ordena los servicios por `.orden`, no por la posición cruda del array del store', () => {
    const serviciosDelStore = [
      servicio({ id: 1, nombre: 'Esmaltado', orden: 2 }),
      servicio({ id: 2, nombre: 'Manicura',  orden: 0 }),
      servicio({ id: 3, nombre: 'Pedicura',  orden: 1 }),
    ];
    useServiciosStore.setState({ servicios: serviciosDelStore });
    useProfesionalStore.setState({
      profesionales: [
        profesional({ id: 1, servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[] }),
      ],
    });

    const { result } = renderHook(() => useHistoriaPrecios());

    expect(result.current.serviciosActivos.map(s => s.nombre)).toEqual([
      'Manicura', 'Pedicura', 'Esmaltado',
    ]);
  });
});

describe('useHistoriaPrecios.selección de servicios', () => {
  const serviciosDelStore = [
    servicio({ id: 1, nombre: 'Esmaltado', orden: 0 }),
    servicio({ id: 2, nombre: 'Manicura',  orden: 1 }),
    servicio({ id: 3, nombre: 'Pedicura',  orden: 2 }),
  ];

  beforeEach(() => {
    useServiciosStore.setState({ servicios: serviciosDelStore });
    useProfesionalStore.setState({
      profesionales: [
        profesional({ id: 1, servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[] }),
        profesional({ id: 2, nombre: 'Otra', activo: true, servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[] }),
      ],
    });
  });

  it('por defecto no excluye nada: serviciosActivos == serviciosDisponibles', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    expect(result.current.serviciosActivos.map(s => s.id)).toEqual([1, 2, 3]);
    expect(result.current.serviciosDisponibles.map(s => s.id)).toEqual([1, 2, 3]);
    expect(result.current.excluidosIds.size).toBe(0);
  });

  it('serviciosActivos solo trae los no excluidos; serviciosDisponibles sigue completo', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setExcluidosIds(new Set([2])));
    expect(result.current.serviciosActivos.map(s => s.id)).toEqual([1, 3]);
    expect(result.current.serviciosDisponibles.map(s => s.id)).toEqual([1, 2, 3]);
  });

  it('con todos excluidos puedeCapturar es false aunque haya fotos', () => {
    useProfesionalStore.setState({
      profesionales: [
        profesional({
          id: 1,
          servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[],
          historia_precios_fotos: [{ id: 1, url: 'x', orden: 0 }] as Profesional['historia_precios_fotos'],
        }),
      ],
    });
    const { result } = renderHook(() => useHistoriaPrecios());
    expect(result.current.puedeCapturar).toBe(true);
    act(() => result.current.setExcluidosIds(new Set([1, 2, 3])));
    expect(result.current.puedeCapturar).toBe(false);
    expect(result.current.hayFotos).toBe(true);
  });

  it('puedeCapturar exige que el contenido entre (entra) y se recupera al volver a entrar', () => {
    useProfesionalStore.setState({
      profesionales: [
        profesional({
          id: 1,
          servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[],
          historia_precios_fotos: [{ id: 1, url: 'x', orden: 0 }] as Profesional['historia_precios_fotos'],
        }),
      ],
    });
    const { result } = renderHook(() => useHistoriaPrecios());
    expect(result.current.entra).toBe(true);
    expect(result.current.puedeCapturar).toBe(true);
    act(() => result.current.onFitChange({ nivel: 3, entra: false }));
    expect(result.current.entra).toBe(false);
    expect(result.current.nivelDensidad).toBe(3);
    expect(result.current.puedeCapturar).toBe(false);
    act(() => result.current.onFitChange({ nivel: 1, entra: true }));
    expect(result.current.puedeCapturar).toBe(true);
  });

  it('onFitChange es estable y no re-renderiza con el mismo resultado', () => {
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useHistoriaPrecios(); });
    const fn = result.current.onFitChange;
    act(() => result.current.onFitChange({ nivel: 2, entra: true }));
    // React puede gastar un render extra al descartar el primer setState
    // idéntico; a partir de ahí repetir el mismo resultado no debe renderizar.
    act(() => result.current.onFitChange({ nivel: 2, entra: true }));
    const antes = renders;
    act(() => result.current.onFitChange({ nivel: 2, entra: true }));
    act(() => result.current.onFitChange({ nivel: 2, entra: true }));
    expect(renders).toBe(antes);
    expect(result.current.onFitChange).toBe(fn);
  });

  it('cambiar de profesional resetea la selección', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setExcluidosIds(new Set([2])));
    act(() => result.current.setSelectedProfesionalId(2));
    expect(result.current.excluidosIds.size).toBe(0);
    expect(result.current.serviciosActivos.map(s => s.id)).toEqual([1, 2, 3]);
  });
});

describe('useHistoriaPrecios.modos de historia', () => {
  const serviciosDelStore = [
    servicio({ id: 1, nombre: 'Esmaltado', orden: 0, categoria_id: 10 }),
    servicio({ id: 2, nombre: 'Manicura',  orden: 1, categoria_id: 10 }),
    servicio({ id: 3, nombre: 'Pedicura',  orden: 2, categoria_id: 20 }),
    servicio({ id: 4, nombre: 'Cejas',     orden: 3, categoria_id: null }),
  ];

  beforeEach(() => {
    useCategoriasServicioStore.setState({
      categorias: [{ id: 10, nombre: 'Uñas' }, { id: 20, nombre: 'Pies' }] as CategoriaServicio[],
    });
    useServiciosStore.setState({ servicios: serviciosDelStore });
    useProfesionalStore.setState({
      profesionales: [
        profesional({
          id: 1,
          servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[],
          historia_precios_fotos: [{ id: 1, url: 'x', orden: 0 }] as Profesional['historia_precios_fotos'],
        }),
        profesional({ id: 2, nombre: 'Otra', servicios: serviciosDelStore.map(s => ({ id: s.id })) as Servicio[] }),
      ],
    });
  });

  it('por defecto es "una": una historia con todos los servicios elegidos', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    expect(result.current.modo).toBe('una');
    expect(result.current.historias).toHaveLength(1);
    expect(result.current.historiaActual?.servicios.map(s => s.id)).toEqual([1, 2, 3, 4]);
    expect(result.current.historiaActual?.titulo).toBeNull();
    expect(result.current.idxHistoria).toBe(0);
  });

  it('en "categoria" arma una historia por categoría y la actual es la primera', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setModo('categoria'));
    expect(result.current.historias).toHaveLength(3);
    expect(result.current.historias[0].titulo).toBe('Uñas');
    expect(result.current.historiaActual?.servicios.map(s => s.id)).toEqual([1, 2]);
  });

  it('irSiguiente/irAnterior recorren las historias con wrap-around', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setModo('categoria'));
    act(() => result.current.irAnterior());
    expect(result.current.idxHistoria).toBe(2);
    act(() => result.current.irSiguiente());
    expect(result.current.idxHistoria).toBe(0);
    act(() => result.current.irSiguiente());
    expect(result.current.historiaActual?.servicios.map(s => s.id)).toEqual([3]);
  });

  it('cambiar de modo o de selección vuelve al índice 0', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setModo('categoria'));
    act(() => result.current.irSiguiente());
    expect(result.current.idxHistoria).toBe(1);
    act(() => result.current.setExcluidosIds(new Set([1])));
    expect(result.current.idxHistoria).toBe(0);
    act(() => result.current.irSiguiente());
    act(() => result.current.setModo('una'));
    expect(result.current.idxHistoria).toBe(0);
  });

  it('el índice se acota si quedan menos historias que antes', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setModo('categoria'));
    act(() => result.current.irAnterior()); // última (Sin categoría)
    act(() => useServiciosStore.setState({ servicios: serviciosDelStore.slice(0, 2) }));
    expect(result.current.historias).toHaveLength(1);
    expect(result.current.idxHistoria).toBe(0);
    expect(result.current.historiaActual?.titulo).toBe('Uñas');
  });

  it('sin servicios elegidos no hay historia actual ni se puede capturar', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setModo('categoria'));
    act(() => result.current.setExcluidosIds(new Set([1, 2, 3, 4])));
    expect(result.current.historias).toEqual([]);
    expect(result.current.historiaActual).toBeNull();
    expect(result.current.puedeCapturar).toBe(false);
    act(() => result.current.irSiguiente());
    expect(result.current.idxHistoria).toBe(0);
  });

  it('puedeCapturar se evalúa sobre la historia actual (hay fotos y servicios en ella)', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setModo('categoria'));
    expect(result.current.puedeCapturar).toBe(true);
  });

  it('cantidadPorCategoria cuenta las historias del modo categoría aunque el modo sea "una"', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    expect(result.current.modo).toBe('una');
    expect(result.current.cantidadPorCategoria).toBe(3);
    act(() => result.current.setExcluidosIds(new Set([3])));
    expect(result.current.cantidadPorCategoria).toBe(2);
  });
});
