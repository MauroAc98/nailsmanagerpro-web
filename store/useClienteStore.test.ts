import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/clienteService', () => ({
  clienteService: { getPaginado: vi.fn() },
}));

import { clienteService } from '@/services/clienteService';
import { useClientesStore } from '@/store/useClienteStore';

const pagina = (current_page: number, last_page: number) =>
  ({ data: [], current_page, last_page, total: 0 }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clienteService.getPaginado).mockResolvedValue(pagina(1, 3));
  useClientesStore.setState({ paginaActual: 0, totalPaginas: 0, buscarActivo: '', estadoActivo: 'todos' });
});

describe('cargarPrimeraPagina — filtro por estado', () => {
  it('sin estado no manda filtro de activo (se listan todos)', async () => {
    await useClientesStore.getState().cargarPrimeraPagina('ana');

    expect(clienteService.getPaginado).toHaveBeenCalledWith({ page: 1, buscar: 'ana', activo: undefined });
  });

  it('"activos" manda activo=true', async () => {
    await useClientesStore.getState().cargarPrimeraPagina('', 'activos');

    expect(clienteService.getPaginado).toHaveBeenCalledWith({ page: 1, buscar: '', activo: true });
  });

  it('"inactivos" manda activo=false', async () => {
    await useClientesStore.getState().cargarPrimeraPagina('', 'inactivos');

    expect(clienteService.getPaginado).toHaveBeenCalledWith({ page: 1, buscar: '', activo: false });
  });

  it('la pagina siguiente conserva busqueda y filtro de la primera', async () => {
    await useClientesStore.getState().cargarPrimeraPagina('ana', 'inactivos');
    vi.mocked(clienteService.getPaginado).mockResolvedValue(pagina(2, 3));

    await useClientesStore.getState().cargarSiguientePagina();

    expect(clienteService.getPaginado).toHaveBeenLastCalledWith({ page: 2, buscar: 'ana', activo: false });
  });
});
