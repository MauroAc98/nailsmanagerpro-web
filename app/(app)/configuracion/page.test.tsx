import { describe, expect, it, vi } from 'vitest';
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

// Reducida a su propósito original ("todo lo necesario para agendar un
// turno"): Reservas online, Seña y pagos, Gastos/Ingresos/Estadísticas,
// Apariencia/Idioma y Ayuda se mudaron a /perfil ("Mi negocio") — ver
// pattern-flex-minwidth-long-names / rediseño de Perfil.
describe('ConfiguracionPage — reducida a "preparar mi agenda"', () => {
  it('muestra solo Servicios, Horarios, Profesionales y Bloqueos', () => {
    conRouter(() => {});
    expect(screen.getByRole('button', { name: 'Servicios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Horarios Disponibles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profesionales' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bloqueos' })).toBeInTheDocument();
  });

  it('ya no muestra lo que se mudó a Mi negocio', () => {
    conRouter(() => {});
    expect(screen.queryByRole('button', { name: 'Reservas online' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gastos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ingresos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Estadísticas' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apariencia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Idioma' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ayuda' })).toBeNull();
  });

  it('navega a la ruta correspondiente al tocar una fila', async () => {
    const push = vi.fn();
    conRouter(push);
    await userEvent.click(screen.getByRole('button', { name: 'Servicios' }));
    expect(push).toHaveBeenCalledWith('/configuracion/servicios');
  });
});
