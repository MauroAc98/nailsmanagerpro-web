import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { proService } from '@/services/proService';
import { useProTurno } from '@/hooks/pro/useProTurno';
import { useProAuthStore } from '@/store/useProAuthStore';
import { cacheTurno, cacheTurnosDia, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProTurno, ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});
const turno = (id: number, notas: string | null = null): ProTurno => ({
  id,
  fecha_hora: '2026-10-17T09:30:00',
  duracion_total_minutos: 30,
  estado_visual: 'confirmado',
  notas,
  cliente: { nombre: 'Lu', apellido: null },
  servicios: [],
  promo: null,
});

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo(1), vinculo(2)], vinculoActivoId: 1, bloqueos: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('useProTurno', () => {
  it('pide el turno al negocio activo', async () => {
    const pedir = vi.spyOn(proService, 'turno').mockResolvedValue(turno(5, 'completa'));
    const { result } = renderHook(() => useProTurno(5));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(pedir).toHaveBeenCalledWith(1, 5, expect.any(AbortSignal));
    expect(result.current.data).toEqual(turno(5, 'completa'));
  });

  it('muestra al instante el turno de la lista del día y luego lo refresca', async () => {
    cacheTurnosDia.set('1:dia:2026-10-17', { turnos: [turno(5, 'resumen')], truncated: false, descartados: 0 });
    vi.spyOn(proService, 'turno').mockResolvedValue(turno(5, 'completa'));
    const { result } = renderHook(() => useProTurno(5, '2026-10-17'));
    expect(result.current.data?.notas).toBe('resumen');
    await waitFor(() => expect(result.current.data?.notas).toBe('completa'));
  });

  it('con error de refresco conserva el turno de la lista', async () => {
    cacheTurnosDia.set('1:dia:2026-10-17', { turnos: [turno(5, 'resumen')], truncated: false, descartados: 0 });
    vi.spyOn(proService, 'turno').mockRejectedValue(Object.assign(new Error('x'), { proError: { kind: 'network' } }));
    const { result } = renderHook(() => useProTurno(5, '2026-10-17'));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'network' }));
    expect(result.current.data?.notas).toBe('resumen');
  });

  it('nunca muestra un turno de otro negocio (semilla ni caché)', () => {
    cacheTurnosDia.set('1:dia:2026-10-17', { turnos: [turno(5)], truncated: false, descartados: 0 });
    cacheTurno.set('1:turno:5', turno(5));
    vi.spyOn(proService, 'turno').mockReturnValue(new Promise(() => {}));
    useProAuthStore.setState({ vinculoActivoId: 2 });
    const { result } = renderHook(() => useProTurno(5, '2026-10-17'));
    expect(result.current.data).toBeNull();
  });

  it('al cambiar de negocio se vacía todo y no queda el turno anterior', () => {
    cacheTurnosDia.set('1:dia:2026-10-17', { turnos: [turno(5)], truncated: false, descartados: 0 });
    vi.spyOn(proService, 'turno').mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProTurno(5, '2026-10-17'));
    expect(result.current.data).not.toBeNull();
    act(() => {
      useProAuthStore.getState().elegirVinculo(2);
    });
    expect(result.current.data).toBeNull();
  });

  it('un id inválido no pide nada', () => {
    const pedir = vi.spyOn(proService, 'turno');
    renderHook(() => useProTurno(0));
    renderHook(() => useProTurno(Number.NaN));
    expect(pedir).not.toHaveBeenCalled();
  });

  it('un 404 de turno llega como notFound', async () => {
    vi.spyOn(proService, 'turno').mockRejectedValue(Object.assign(new Error('x'), { proError: { kind: 'notFound' } }));
    const { result } = renderHook(() => useProTurno(5));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'notFound' }));
  });
});
