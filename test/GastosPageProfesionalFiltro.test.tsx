import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/render';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/services/gastoService', async (orig) => ({
  ...(await orig<typeof import('@/services/gastoService')>()),
  gastoService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/profesionalService', async (orig) => ({
  ...(await orig<typeof import('@/services/profesionalService')>()),
  profesionalService: { getAll: vi.fn() },
}));

import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useGastosStore } from '@/store/useGastoStore';
import { resetNavigationMock } from '@/test/mocks/nextNavigation';
import GastosPage from '@/app/(app)/configuracion/gastos/page';

const prof = (id: number, nombre: string, activo = true): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo, servicios: [] } as unknown as Profesional);

const gasto = (id: number, profesional_id: number | null, descripcion: string) =>
  ({ id, monto: 100, categoria: 'otros', descripcion, fecha: new Date().toISOString().slice(0, 10), profesional_id } as never);

function montar(profesionales: Profesional[]) {
  useProfesionalStore.setState({ profesionales });
  vi.mocked(profesionalService.getAll).mockResolvedValue(profesionales);
  useGastosStore.setState({ gastos: [gasto(1, 1, 'Gasto de Ana'), gasto(2, 2, 'Gasto de Laura')], loading: false, error: null });
  renderWithProviders(<GastosPage />);
  fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
});

describe('GastosPage — filtro de profesional (fila + hoja)', () => {
  it('con una sola profesional activa no hay fila', () => {
    montar([prof(1, 'Ana'), prof(2, 'Laura', false)]);
    expect(screen.queryByRole('button', { name: /^Profesional:/ })).toBeNull();
  });

  it('ofrece todo el equipo (por defecto) y cada profesional activa', () => {
    montar([prof(1, 'Ana'), prof(2, 'Laura')]);
    fireEvent.click(screen.getByRole('button', { name: 'Profesional: Todo el equipo' }));
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
      expect.stringContaining('Todo el equipo'), expect.stringContaining('Ana'), expect.stringContaining('Laura'),
    ]);
  });

  it('elegir una profesional actualiza la fila y vuelve a todo el equipo', async () => {
    montar([prof(1, 'Ana'), prof(2, 'Laura')]);
    fireEvent.click(screen.getByRole('button', { name: 'Profesional: Todo el equipo' }));
    fireEvent.click(screen.getByRole('option', { name: /Laura/ }));
    expect(await screen.findByRole('button', { name: 'Profesional: Laura' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Limpiar filtros')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Profesional: Laura' }));
    fireEvent.click(screen.getByRole('option', { name: /Todo el equipo/ }));
    expect(await screen.findByRole('button', { name: 'Profesional: Todo el equipo' })).toBeInTheDocument();
    expect(screen.queryByText('Limpiar filtros')).toBeNull();
  });
});
