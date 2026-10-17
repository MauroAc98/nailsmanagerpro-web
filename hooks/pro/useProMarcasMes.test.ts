import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { proService } from '@/services/proService';
import { useProMarcasMes } from '@/hooks/pro/useProMarcasMes';
import { useProAuthStore } from '@/store/useProAuthStore';
import { cacheMarcas, vaciarCachesPro } from '@/lib/pro/caches';
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

describe('useProMarcasMes', () => {
  it('pide las marcas del mes y deja el objeto con descartados', async () => {
    const marcas = vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [{ fecha: '2026-10-03', cantidad: 2 }], descartados: 1 });
    const { result } = renderHook(() => useProMarcasMes('2026-10'));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(marcas).toHaveBeenCalledWith(1, '2026-10', expect.any(AbortSignal));
    expect(result.current.data).toEqual({ dias: [{ fecha: '2026-10-03', cantidad: 2 }], descartados: 1 });
    expect(cacheMarcas.get('1:marcas:2026-10')).toBeDefined();
  });

  it('un mes inválido no pide nada', () => {
    const marcas = vi.spyOn(proService, 'marcas');
    renderHook(() => useProMarcasMes('2026-13'));
    expect(marcas).not.toHaveBeenCalled();
  });

  it('volver a un mes ya visto lo muestra al instante y lo refresca', async () => {
    cacheMarcas.set('1:marcas:2026-10', { dias: [{ fecha: '2026-10-03', cantidad: 1 }], descartados: 0 });
    vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [], descartados: 0 });
    const { result } = renderHook(() => useProMarcasMes('2026-10'));
    expect(result.current.data?.dias).toHaveLength(1);
    await waitFor(() => expect(result.current.data?.dias).toHaveLength(0));
  });
});
