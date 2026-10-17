import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { proService } from '@/services/proService';
import { useProResumen } from '@/hooks/pro/useProResumen';
import { useProAuthStore } from '@/store/useProAuthStore';
import { cacheResumen, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProResumen, ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});

const resumen = (atendidos: number): ProResumen => ({ atendidos, por_venir: 2, cancelados: 1, mas_pedido: 'Gel' });

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo(1), vinculo(2)], vinculoActivoId: 1, bloqueos: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('useProResumen', () => {
  it('pide el resumen del mes del negocio activo y lo guarda en la caché por vínculo y mes', async () => {
    const pedir = vi.spyOn(proService, 'resumen').mockResolvedValue(resumen(5));
    const { result } = renderHook(() => useProResumen('2026-10'));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(pedir).toHaveBeenCalledWith(1, '2026-10', expect.any(AbortSignal));
    expect(result.current.data).toEqual(resumen(5));
    expect(cacheResumen.get('1:resumen:2026-10')).toEqual(resumen(5));
  });

  it('un mes inválido o vacío no pide nada', () => {
    const pedir = vi.spyOn(proService, 'resumen');
    renderHook(() => useProResumen('2026-13'));
    renderHook(() => useProResumen(''));
    expect(pedir).not.toHaveBeenCalled();
  });

  it('volver a un mes ya visto lo muestra al instante y lo refresca de fondo', async () => {
    cacheResumen.set('1:resumen:2026-10', resumen(1));
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen(7));
    const { result } = renderHook(() => useProResumen('2026-10'));
    expect(result.current.data?.atendidos).toBe(1);
    await waitFor(() => expect(result.current.data?.atendidos).toBe(7));
  });

  it('la caché no se comparte entre negocios', () => {
    cacheResumen.set('2:resumen:2026-10', resumen(9));
    vi.spyOn(proService, 'resumen').mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useProResumen('2026-10'));
    expect(result.current.data).toBeNull();
  });

  it('un fallo queda en error y no deja datos', async () => {
    vi.spyOn(proService, 'resumen').mockRejectedValue(Object.assign(new Error('x'), { proError: { kind: 'server' } }));
    const { result } = renderHook(() => useProResumen('2026-10'));
    await waitFor(() => expect(result.current.error).toEqual({ kind: 'server' }));
    expect(result.current.data).toBeNull();
  });
});
