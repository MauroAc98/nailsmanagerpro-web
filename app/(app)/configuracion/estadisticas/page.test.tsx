import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
// Los gráficos de Recharts viven en chunks dinámicos (ssr:false); acá no se
// prueban (ver components/estadisticas/charts.test.tsx), solo la página.
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/store/useProfesionalStore', () => ({
  useProfesionalStore: () => ({ profesionales: [], fetchProfesionales: vi.fn() }),
}));
vi.mock('@/services/statsService', () => ({
  statsService: {
    getDashboard: vi.fn(),
    getGananciasPorPeriodo: vi.fn(async () => ({ puntos: [], truncado: false })),
    getOcupacion: vi.fn(async () => []),
  },
}));

import { statsService, type DashboardStats } from '@/services/statsService';
import EstadisticasPage from './page';

const getDashboard = vi.mocked(statsService.getDashboard);

function dashboard(over: Partial<DashboardStats> = {}): DashboardStats {
  return {
    total_turnos: 68,
    turnos_por_estado: { completados: 64, confirmados: 0, cancelados: 4 },
    servicios_mas_pedidos: [],
    clientes: { nuevas: 3, recurrentes: 41 },
    ganancias: 1560000,
    gastos: 275500,
    ganancia_neta: 1284500,
    ganancias_por_servicio: [],
    ganancias_por_dia: [],
    turnos_por_estado_por_dia_semana: [],
    ...over,
  };
}

beforeEach(() => {
  resetNavigationMock();
  localStorage.clear();
  getDashboard.mockReset();
  setMockLocation('/configuracion/estadisticas', 'mes=2026-10');
});

describe('Estadísticas — héroe', () => {
  it('muestra ganancia neta, ticket promedio y % de cancelaciones', async () => {
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/1\.284\.500/)).toBeInTheDocument();
    // 1.560.000 / 64 completados
    expect(screen.getByText(/24\.375/)).toBeInTheDocument();
    // 4 cancelados de 68
    expect(screen.getByText('6%')).toBeInTheDocument();
  });

  it('compara contra el mes anterior pidiendo ese rango al backend', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01' ? dashboard({ ganancia_neta: 1000000 }) : dashboard());
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/28% vs Septiembre/)).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-30', undefined);
  });

  it('sin base de comparación (mes previo en 0) no muestra la insignia', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01' ? dashboard({ ganancia_neta: 0, ganancias: 0 }) : dashboard());
    renderWithProviders(<EstadisticasPage />);

    await screen.findByText(/1\.284\.500/);
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-30', undefined));
    expect(screen.queryByText(/vs Septiembre/)).toBeNull();
  });

  it('si falla el mes anterior la pantalla funciona igual, sin error ni insignia', async () => {
    getDashboard.mockImplementation(async (desde: string) => {
      if (desde === '2026-09-01') throw new Error('boom');
      return dashboard();
    });
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/1\.284\.500/)).toBeInTheDocument();
    expect(screen.queryByText(/vs Septiembre/)).toBeNull();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });

  it('en rango personalizado no hay comparación con el mes anterior', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-09-01' ? dashboard({ ganancia_neta: 1000000 }) : dashboard());
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText(/28% vs Septiembre/);

    fireEvent.click(screen.getByRole('button', { name: 'Rango personalizado' }));

    await waitFor(() => expect(screen.queryByText(/vs Septiembre/)).toBeNull());
  });

  it('con ocultar monto activo el héroe tapa el importe', async () => {
    localStorage.setItem('agenda:ocultarMontoResumen', '1');
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);

    await screen.findByText('turnos');
    await waitFor(() => expect(screen.queryByText(/1\.284\.500/)).toBeNull());
    expect(screen.getByRole('button', { name: 'Mostrar monto' })).toBeInTheDocument();
  });
});

describe('Estadísticas — consejos', () => {
  it('no muestra consejos de día pico/flojo con pocos turnos', async () => {
    getDashboard.mockResolvedValue(dashboard({
      turnos_por_estado_por_dia_semana: [{ dia_semana: 6, completados: 3, confirmados: 0, cancelados: 0 }],
    }));
    renderWithProviders(<EstadisticasPage />);
    await screen.findByText(/1\.284\.500/);
    expect(screen.queryByText(/concentra el/)).toBeNull();
    expect(screen.queryByText(/día más flojo/)).toBeNull();
  });

  it('muestra el día pico cuando hay datos suficientes', async () => {
    const dias = [3, 4, 5, 3, 4, 18, 3].map((c, i) => ({ dia_semana: i + 1, completados: c, confirmados: 0, cancelados: 0 }));
    getDashboard.mockResolvedValue(dashboard({ turnos_por_estado_por_dia_semana: dias }));
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/concentra el 45% de tus turnos/)).toBeInTheDocument();
  });

  it('muestra la retención de clientas', async () => {
    getDashboard.mockResolvedValue(dashboard());
    renderWithProviders(<EstadisticasPage />);
    expect(await screen.findByText(/93% de tus clientas ya había venido antes/)).toBeInTheDocument();
  });
});
