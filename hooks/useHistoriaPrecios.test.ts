import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useHistoriaPrecios } from './useHistoriaPrecios';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import type { Profesional } from '@/services/profesionalService';
import type { Servicio } from '@/services/servicioService';

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

  it('cambiar de profesional resetea la selección', () => {
    const { result } = renderHook(() => useHistoriaPrecios());
    act(() => result.current.setExcluidosIds(new Set([2])));
    act(() => result.current.setSelectedProfesionalId(2));
    expect(result.current.excluidosIds.size).toBe(0);
    expect(result.current.serviciosActivos.map(s => s.id)).toEqual([1, 2, 3]);
  });
});
