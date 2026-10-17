import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { proService } from '@/services/proService';
import { useProServicios } from '@/hooks/pro/useProServicios';
import { useProAuthStore } from '@/store/useProAuthStore';
import { cacheServicios, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProVinculo } from '@/lib/pro/tipos';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
});

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo(1)], vinculoActivoId: 1, bloqueos: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('useProServicios', () => {
  it('pide los servicios del negocio activo y conserva descartados', async () => {
    const servicios = vi.spyOn(proService, 'servicios').mockResolvedValue({ servicios: [{ id: 3, nombre: 'Uñas' }], descartados: 2 });
    const { result } = renderHook(() => useProServicios());
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(servicios).toHaveBeenCalledWith(1, expect.any(AbortSignal));
    expect(result.current.data).toEqual({ servicios: [{ id: 3, nombre: 'Uñas' }], descartados: 2 });
    expect(cacheServicios.get('1:servicios')).toBeDefined();
  });

  it('sin negocio activo no pide nada', () => {
    useProAuthStore.setState({ vinculoActivoId: null });
    const servicios = vi.spyOn(proService, 'servicios');
    renderHook(() => useProServicios());
    expect(servicios).not.toHaveBeenCalled();
  });
});
