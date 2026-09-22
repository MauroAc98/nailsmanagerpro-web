import { describe, expect, it, vi } from 'vitest';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { renderWithProviders, screen } from '@/test/render';
import userEvent from '@testing-library/user-event';
import FinanzasPage from './page';

function conRouter(push: (ruta: string) => void) {
  const router = { push } as unknown as AppRouterInstance;
  return renderWithProviders(
    <AppRouterContext.Provider value={router}>
      <FinanzasPage />
    </AppRouterContext.Provider>,
  );
}

// Agrupa Gastos, Ingresos y Estadísticas en una sola fila de "Mi negocio" —
// las 3 pantallas de destino no cambian (ver rediseño de Perfil).
describe('FinanzasPage', () => {
  it('muestra Gastos, Ingresos y Estadísticas', () => {
    conRouter(() => {});
    expect(screen.getByRole('button', { name: 'Gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estadísticas' })).toBeInTheDocument();
  });

  it('navega a la ruta correspondiente al tocar una fila', async () => {
    const push = vi.fn();
    conRouter(push);
    await userEvent.click(screen.getByRole('button', { name: 'Ingresos' }));
    expect(push).toHaveBeenCalledWith('/configuracion/ingresos');
  });
});
