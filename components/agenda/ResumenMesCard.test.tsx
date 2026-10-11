import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import { statsService } from '@/services/statsService';
import { ResumenMesCard, vaciarCacheResumenMes } from './ResumenMesCard';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/services/statsService', () => ({
  statsService: { getDashboard: vi.fn() },
}));

const getDashboard = vi.mocked(statsService.getDashboard);

function stats(overrides: Record<string, unknown> = {}) {
  return {
    total_turnos: 45,
    turnos_por_estado: { completados: 34, confirmados: 11, cancelados: 2 },
    servicios_mas_pedidos: [{ nombre: 'Esmaltado semipermanente con diseño', cantidad: 8 }],
    clientes: { nuevas: 5, recurrentes: 3 },
    ganancias: 607300,
    gastos: 0,
    ganancia_neta: 607300,
    ganancias_por_servicio: [],
    ganancias_por_dia: [],
    turnos_por_estado_por_dia_semana: [],
    ...overrides,
  };
}

const octubre = new Date(2026, 9, 1);

// "Hoy" fijo: octubre es el mes en curso (se compara lo que va del mes).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 11, 12, 0));
  vaciarCacheResumenMes();
  getDashboard.mockReset();
  getDashboard.mockResolvedValue(stats() as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ResumenMesCard', () => {
  it('el encabezado dice "Resumen de" y el mes', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    expect(await screen.findByText('Resumen de octubre')).toBeInTheDocument();
  });

  it('muestra lo cobrado sin decimales, con su rótulo', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    expect(await screen.findByText('$607.300')).toBeInTheDocument();
    expect(screen.getByText('cobrado')).toBeInTheDocument();
  });

  // Cada número con su rótulo debajo, en columnas.
  function columna(valor: string, rotulo: string) {
    const r = screen.getByText(rotulo);
    expect(r.previousElementSibling?.textContent).toBe(valor);
  }

  it('los números del mes en columnas: atendidos, por venir, clientes nuevos y cancelados', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('atendidos');
    columna('34', 'atendidos');
    columna('11', 'por venir');
    columna('5', 'clientes nuevos');
    columna('2', 'cancelados');
    // Ya no suma los confirmados como "completados" (antes: total_turnos).
    expect(screen.queryByText(/completados/)).not.toBeInTheDocument();
  });

  it('el servicio más pedido se lee completo: baja de renglón en vez de cortarse', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    const nombre = await screen.findByText('Esmaltado semipermanente con diseño');
    const fila = nombre.parentElement as HTMLElement;
    expect(fila.textContent).toBe('Más pedido: Esmaltado semipermanente con diseño');
    expect(fila.style.overflowWrap).toBe('anywhere');
    expect(nombre.style.webkitLineClamp).toBe('');
  });

  it('en singular cuando hay uno solo', async () => {
    getDashboard.mockResolvedValue(stats({
      turnos_por_estado: { completados: 1, confirmados: 1, cancelados: 1 },
      clientes: { nuevas: 1, recurrentes: 0 },
    }) as never);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('atendido');
    columna('1', 'atendido');
    columna('1', 'cliente nuevo');
    columna('1', 'cancelado');
  });

  // El card pide el mes que se mira y el de comparación; se distinguen por
  // el mes de `desde`. Guarda los rangos pedidos para verificar el tramo.
  function conPrevio(mesActual: string, actual: number, previo: number) {
    getDashboard.mockImplementation(async (desde: string) =>
      stats({ ganancias: desde.startsWith(mesActual) ? actual : previo }) as never);
  }

  it('mes en curso: compara lo que va del mes con los mismos días del mes pasado', async () => {
    conPrevio('2026-10', 660000, 600000);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    expect(await screen.findByText('10%')).toBeInTheDocument();
    expect(screen.getByText('más que septiembre')).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledWith('2026-09-01', '2026-09-11', undefined);
  });

  it('si se cobró menos, lo dice', async () => {
    conPrevio('2026-10', 552000, 600000);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    expect(await screen.findByText('8%')).toBeInTheDocument();
    expect(screen.getByText('menos que septiembre')).toBeInTheDocument();
  });

  it('mes cerrado: compara con el mes anterior entero', async () => {
    conPrevio('2026-09', 660000, 600000);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={new Date(2026, 8, 1)} />);
    expect(await screen.findByText('más que agosto')).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledWith('2026-08-01', '2026-08-31', undefined);
  });

  it('sin cobros el mes pasado no muestra comparación', async () => {
    conPrevio('2026-10', 607300, 0);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('Resumen de octubre');
    expect(screen.queryByText(/que septiembre/)).not.toBeInTheDocument();
  });

  it('con el monto oculto, también se oculta la comparación', async () => {
    conPrevio('2026-10', 660000, 600000);
    localStorage.setItem('agenda:ocultarMontoResumen', '1');
    try {
      renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
      await screen.findByText('Resumen de octubre');
      expect(screen.queryByText('$607.300')).not.toBeInTheDocument();
      expect(screen.queryByText(/que septiembre/)).not.toBeInTheDocument();
    } finally {
      localStorage.removeItem('agenda:ocultarMontoResumen');
    }
  });
});

describe('ResumenMesCard — cambio de profesional / mes', () => {
  // Respuesta pendiente a mano, para ver el estado "cargando".
  function pendiente() {
    let resolver!: (v: never) => void;
    const promesa = new Promise<never>(r => { resolver = r; });
    return { promesa, resolver };
  }

  it('al cambiar de profesional sigue montada, con esqueletos y sin la plata de la anterior', async () => {
    getDashboard.mockImplementation(async (_d: string, _h: string, prof?: number) =>
      stats({ ganancias: prof === 7 ? 111000 : 607300 }) as never);
    const { rerender } = renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    expect(await screen.findByText('$607.300')).toBeInTheDocument();

    const lento = pendiente();
    getDashboard.mockImplementation(() => lento.promesa);
    rerender(<ResumenMesCard profesionalId={7} viewDate={octubre} />);

    expect(screen.getByText('Resumen de octubre')).toBeInTheDocument();
    expect(screen.queryByText('$607.300')).not.toBeInTheDocument();
    expect(screen.getByTestId('resumen-mes-esqueleto')).toBeInTheDocument();
  });

  it('cuando llega lo nuevo reemplaza los esqueletos por los números', async () => {
    const { rerender } = renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('$607.300');

    getDashboard.mockResolvedValue(stats({ ganancias: 111000 }) as never);
    rerender(<ResumenMesCard profesionalId={7} viewDate={octubre} />);

    expect(await screen.findByText('$111.000')).toBeInTheDocument();
    expect(screen.queryByTestId('resumen-mes-esqueleto')).not.toBeInTheDocument();
  });

  it('si lo nuevo no tiene turnos, se oculta como siempre', async () => {
    const { rerender } = renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('$607.300');

    getDashboard.mockResolvedValue(stats({ total_turnos: 0 }) as never);
    rerender(<ResumenMesCard profesionalId={7} viewDate={octubre} />);

    await waitFor(() => expect(screen.queryByText('Resumen de octubre')).not.toBeInTheDocument());
  });

  it('si el pedido nuevo falla, se oculta (nunca queda la plata vieja ni un esqueleto eterno)', async () => {
    const { rerender } = renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('$607.300');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    getDashboard.mockRejectedValue(new Error('sin red'));
    rerender(<ResumenMesCard profesionalId={7} viewDate={octubre} />);

    await waitFor(() => expect(screen.queryByText('Resumen de octubre')).not.toBeInTheDocument());
    log.mockRestore();
  });

  it('antes de la primera carga no ocupa lugar (sin esqueleto)', () => {
    getDashboard.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    expect(screen.queryByText('Resumen de octubre')).not.toBeInTheDocument();
  });

  it('al volver a una selección ya vista muestra sus números al instante', async () => {
    getDashboard.mockImplementation(async (_d: string, _h: string, prof?: number) =>
      stats({ ganancias: prof === 7 ? 111000 : 607300 }) as never);
    const { rerender } = renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={octubre} />);
    await screen.findByText('$607.300');
    rerender(<ResumenMesCard profesionalId={7} viewDate={octubre} />);
    await screen.findByText('$111.000');

    getDashboard.mockImplementation(() => new Promise(() => {})); // el refresco de fondo queda en vuelo
    rerender(<ResumenMesCard profesionalId={null} viewDate={octubre} />);

    expect(screen.getByText('$607.300')).toBeInTheDocument();
    expect(screen.queryByTestId('resumen-mes-esqueleto')).not.toBeInTheDocument();
  });
});
