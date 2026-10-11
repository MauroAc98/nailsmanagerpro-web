import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { statsService } from '@/services/statsService';
import { ResumenMesCard } from './ResumenMesCard';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/services/statsService', () => ({
  statsService: { getDashboard: vi.fn() },
}));

const getDashboard = vi.mocked(statsService.getDashboard);

function stats(overrides: Record<string, unknown> = {}) {
  return {
    total_turnos: 47,
    turnos_por_estado: { completados: 34, confirmados: 11, cancelados: 2 },
    servicios_mas_pedidos: [{ nombre: 'Esmaltado semipermanente con diseño', cantidad: 8 }],
    clientes: { nuevas: 5, recurrentes: 3 },
    ganancias: 705000,
    gastos: 0,
    ganancia_neta: 705000,
    ganancias_por_servicio: [],
    ganancias_por_dia: [],
    turnos_por_estado_por_dia_semana: [],
    ...overrides,
  };
}

// El mes que se mira vs. el previo: el card pide los dos, y se distinguen por
// el mes de `desde`.
function responder(actual: ReturnType<typeof stats>, previo: ReturnType<typeof stats>, viewDate: Date) {
  const mesActual = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
  getDashboard.mockImplementation(async (desde: string) =>
    (desde.startsWith(mesActual) ? actual : previo) as never);
}

const septiembre = new Date(2026, 8, 1);

beforeEach(() => {
  getDashboard.mockReset();
});

describe('ResumenMesCard', () => {
  it('muestra lo cobrado y los turnos del mes: atendidos, por venir y cancelados', async () => {
    responder(stats(), stats({ ganancias: 0 }), septiembre);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={septiembre} />);

    expect(await screen.findByText('Cobrado')).toBeInTheDocument();
    expect(screen.getByText('$705.000,00')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('turnos atendidos')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('turnos por venir')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('cancelados')).toBeInTheDocument();
  });

  it('ya no usa el total (completados + confirmados) como "completados"', async () => {
    responder(stats(), stats({ ganancias: 0 }), septiembre);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={septiembre} />);

    await screen.findByText('Cobrado');
    expect(screen.queryByText('47')).not.toBeInTheDocument();
    expect(screen.queryByText(/turnos completados/)).not.toBeInTheDocument();
  });

  it('el servicio más pedido se lee completo: baja de renglón en vez de cortarse', async () => {
    responder(stats(), stats({ ganancias: 0 }), septiembre);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={septiembre} />);

    const nombre = await screen.findByText('Esmaltado semipermanente con diseño');
    expect(nombre.style.webkitLineClamp).toBe('');
    expect(nombre.style.overflowWrap).toBe('anywhere');
    expect(screen.getByText('El más pedido')).toBeInTheDocument();
    expect(screen.getByText('clientes nuevos')).toBeInTheDocument();
  });

  it('compara lo cobrado con el mes anterior', async () => {
    responder(stats({ ganancias: 660000 }), stats({ ganancias: 600000 }), septiembre);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={septiembre} />);

    expect(await screen.findByText('10% vs. ago')).toBeInTheDocument();
  });

  it('sin cobros el mes anterior no muestra comparación', async () => {
    responder(stats(), stats({ ganancias: 0 }), septiembre);
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={septiembre} />);

    await screen.findByText('Cobrado');
    expect(screen.queryByText(/vs\./)).not.toBeInTheDocument();
  });
});
