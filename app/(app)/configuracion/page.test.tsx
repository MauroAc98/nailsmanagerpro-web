import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { renderWithProviders, screen } from '@/test/render';
import userEvent from '@testing-library/user-event';
import ConfiguracionPage from './page';

// Router real de Next inyectado por su contexto (sin mockear modulos).
function conRouter(push: (ruta: string) => void) {
  const router = { push } as unknown as AppRouterInstance;
  return renderWithProviders(
    <AppRouterContext.Provider value={router}>
      <ConfiguracionPage />
    </AppRouterContext.Provider>,
  );
}

describe('Configuracion: fila "Reservas online"', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('con la flag apagada la fila no aparece', () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'false');
    conRouter(() => {});
    expect(screen.queryByRole('button', { name: 'Reservas online' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Servicios' })).toBeInTheDocument();
  });

  it('con la flag prendida aparece y navega a la pantalla de ajustes', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    const push = vi.fn();
    conRouter(push);
    await userEvent.click(screen.getByRole('button', { name: 'Reservas online' }));
    expect(push).toHaveBeenCalledWith('/configuracion/reservas-online');
  });
});
