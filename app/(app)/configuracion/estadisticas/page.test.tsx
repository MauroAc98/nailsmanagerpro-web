import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
// Los gráficos de Recharts viven en chunks dinámicos (ssr:false); acá no se
// prueban (ver components/estadisticas/charts.test.tsx), solo la página.
// Los mocks capturan las props de TendenciaChart para poder afirmar qué serie recibe.
const chartProps = vi.hoisted(() => ({ tendencia: null as null | { puntos: { label: string; monto: number | null }[]; previo?: (number | undefined)[] } }));
vi.mock('next/dynamic', () => ({
  default: () => function ChartMock(props: { puntos?: { label: string; monto: number | null }[]; previo?: (number | undefined)[] }) {
    if (props.puntos) chartProps.tendencia = { puntos: props.puntos, previo: props.previo };
    return null;
  },
}));
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
  // Fecha fija: 15/11/2026 => octubre ya es un mes CERRADO (comparación contra septiembre completo).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15, 12) });
  chartProps.tendencia = null;
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

describe('Estadísticas — mes en curso', () => {
  beforeEach(() => {
    // 2/10/2026: octubre está en curso con solo 2 días.
    vi.setSystemTime(new Date(2026, 9, 2, 12));
  });

  const diasOctubre = (hasta: number) =>
    Array.from({ length: hasta }, (_, i) => ({ fecha: `2026-10-0${i + 1}`, monto: 1000 * (i + 1) }));

  it('compara contra el MISMO período del mes anterior (día 1 al día de hoy), no contra septiembre completo', async () => {
    getDashboard.mockImplementation(async (desde: string, hasta: string) => {
      if (desde === '2026-09-01' && hasta === '2026-09-02') return dashboard({ ganancia_neta: 1000000 });
      if (desde === '2026-09-01') return dashboard({ ganancia_neta: 9000000 });
      return dashboard();
    });
    renderWithProviders(<EstadisticasPage />);

    expect(await screen.findByText(/28% vs Septiembre al día 2/)).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-02', undefined);
  });

  it('sin base de comparación en el mismo período (previo en 0) oculta la insignia', async () => {
    getDashboard.mockImplementation(async (desde: string, hasta: string) => {
      if (desde === '2026-09-01' && hasta === '2026-09-02') return dashboard({ ganancia_neta: 0, ganancias: 0 });
      if (desde === '2026-09-01') return dashboard({ ganancia_neta: 9000000 });
      return dashboard();
    });
    renderWithProviders(<EstadisticasPage />);

    await screen.findByText(/1\.284\.500/);
    await waitFor(() => expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-02', undefined));
    expect(screen.queryByText(/vs Septiembre/)).toBeNull();
  });

  it('la serie del mes en curso se corta hoy: los días futuros van null, no 0', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-10-01' ? dashboard({ ganancias_por_dia: diasOctubre(2) }) : dashboard({ ganancias_por_dia: [] }));
    renderWithProviders(<EstadisticasPage />);

    await waitFor(() => expect(chartProps.tendencia).not.toBeNull());
    const { puntos } = chartProps.tendencia!;
    expect(puntos).toHaveLength(31);
    expect(puntos.slice(0, 2).map(p => p.monto)).toEqual([1000, 2000]);
    expect(puntos.slice(2).every(p => p.monto === null)).toBe(true);
  });

  it('un día de hoy sin turnos sigue siendo 0 (pasado/presente), solo el futuro es null', async () => {
    getDashboard.mockImplementation(async (desde: string) =>
      desde === '2026-10-01' ? dashboard({ ganancias_por_dia: diasOctubre(1) }) : dashboard());
    renderWithProviders(<EstadisticasPage />);

    await waitFor(() => expect(chartProps.tendencia).not.toBeNull());
    expect(chartProps.tendencia!.puntos[1].monto).toBe(0);
    expect(chartProps.tendencia!.puntos[2].monto).toBeNull();
  });

  it('en un mes cerrado la serie va completa (sin nulls)', async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    getDashboard.mockResolvedValue(dashboard({ ganancias_por_dia: diasOctubre(2) }));
    renderWithProviders(<EstadisticasPage />);

    await waitFor(() => expect(chartProps.tendencia).not.toBeNull());
    expect(chartProps.tendencia!.puntos.every(p => p.monto !== null)).toBe(true);
  });
});
