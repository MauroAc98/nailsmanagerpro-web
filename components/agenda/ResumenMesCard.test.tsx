import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';
import { routerMock } from '@/test/mocks/nextNavigation';
import { ResumenMesCard } from './ResumenMesCard';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/services/statsService', () => ({
  statsService: {
    getDashboard: vi.fn().mockResolvedValue({
      total_turnos: 24,
      turnos_por_estado: { completados: 24, confirmados: 0, cancelados: 0 },
      servicios_mas_pedidos: [{ nombre: 'Claritos/mechas/iluminacion', cantidad: 8 }],
      clientes: { nuevas: 9, recurrentes: 3 },
      ganancias: 705000,
      gastos: 0,
      ganancia_neta: 705000,
      ganancias_por_servicio: [],
      ganancias_por_dia: [],
      turnos_por_estado_por_dia_semana: [],
    }),
  },
}));

// Versión compacta (rediseño de jerarquía del home): una sola línea con mes,
// cantidad y monto — el detalle (servicio top, clientas nuevas) vive en
// Estadísticas, a un toque.
describe('ResumenMesCard — una línea', () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    localStorage.clear();
  });

  it('muestra mes, cantidad de turnos y monto en una sola fila', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={new Date(2026, 8, 1)} />);

    expect(await screen.findByText('24 turnos')).toBeInTheDocument();
    expect(screen.getByText('Septiembre')).toBeInTheDocument();
    expect(screen.getByText(/705\.000/)).toBeInTheDocument();
  });

  it('ya no repite el detalle que vive en Estadísticas', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={new Date(2026, 8, 1)} />);
    await screen.findByText('24 turnos');
    expect(screen.queryByText('Claritos/mechas/iluminacion')).toBeNull();
    expect(screen.queryByText(/clientes? nuevos?/)).toBeNull();
  });

  it('al tocarlo navega a Estadísticas del mes visible', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={new Date(2026, 8, 1)} />);
    fireEvent.click(await screen.findByRole('button', { name: /Ver estadísticas/ }));
    expect(routerMock.push).toHaveBeenCalledWith('/configuracion/estadisticas?mes=2026-09');
  });

  it('el botón de ocultar monto es un botón real, separado del que navega', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={new Date(2026, 8, 1)} />);
    await screen.findByText('24 turnos');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar monto' }));
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mostrar monto' })).toBeInTheDocument();
  });
});
