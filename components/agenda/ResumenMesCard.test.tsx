import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { ResumenMesCard } from './ResumenMesCard';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/services/statsService', () => ({
  statsService: {
    getDashboard: vi.fn().mockResolvedValue({
      total_turnos: 12,
      turnos_por_estado: { completados: 12, confirmados: 0, cancelados: 0 },
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

// A user-entered top-service name (e.g. "Claritos/mechas/iluminacion") used to
// overflow the card because its block was flex-shrink:0 with no width limit.
describe('ResumenMesCard — long top-service name', () => {
  it('clamps the name to two lines instead of overflowing the card', async () => {
    renderWithProviders(<ResumenMesCard profesionalId={null} viewDate={new Date()} />);

    const nombre = await screen.findByText('Claritos/mechas/iluminacion');
    expect(nombre.style.overflow).toBe('hidden');
    expect(nombre.style.webkitLineClamp).toBe('2');
    expect(nombre.style.overflowWrap).toBe('anywhere');

    // The block is allowed to shrink and is capped, so it can't push past the card.
    const bloque = nombre.parentElement as HTMLElement;
    expect(bloque.style.minWidth).toBe('0');
    expect(bloque.style.maxWidth).toBe('55%');
  });
});
