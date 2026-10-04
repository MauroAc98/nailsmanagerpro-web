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
  it('muestra Cobros, Gastos, Ingresos y Estadísticas', () => {
    conRouter(() => {});
    expect(screen.getByRole('button', { name: 'Cobros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otros ingresos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estadísticas' })).toBeInTheDocument();
  });

  it('Cobros es la primera opción y lleva a /configuracion/cobros', async () => {
    const push = vi.fn();
    conRouter(push);
    const cobros = screen.getByRole('button', { name: 'Cobros' });
    const gastos = screen.getByRole('button', { name: 'Gastos' });
    expect(cobros.compareDocumentPosition(gastos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(cobros);
    expect(push).toHaveBeenCalledWith('/configuracion/cobros');
  });

  it('navega a la ruta correspondiente al tocar una fila', async () => {
    const push = vi.fn();
    conRouter(push);
    await userEvent.click(screen.getByRole('button', { name: 'Otros ingresos' }));
    expect(push).toHaveBeenCalledWith('/configuracion/ingresos');
  });
});
