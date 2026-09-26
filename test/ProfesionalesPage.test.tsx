import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '@/test/render';

// Page-level tests for the studio "atiende en paralelo" setting (PR 2d),
// added to the existing Profesionales screen: it is the one place the active
// professional count is already front and center.
vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/services/profesionalService', async (orig) => ({
  ...(await orig<typeof import('@/services/profesionalService')>()),
  profesionalService: { getAll: vi.fn() },
}));
vi.mock('@/services/authService', async (orig) => ({
  ...(await orig<typeof import('@/services/authService')>()),
  authService: { updatePerfil: vi.fn() },
}));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: vi.fn().mockResolvedValue(undefined) }));

import { alertDialog } from '@/store/useConfirmStore';
import { authService, type User } from '@/services/authService';
import { profesionalService, type Profesional } from '@/services/profesionalService';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useAuthStore } from '@/store/useAuthStore';
import ProfesionalesPage from '@/app/(app)/configuracion/profesionales/page';

// Test-only helper: only `atiende_en_paralelo` matters here, same pattern as
// EditarServicioPage.test.tsx's `conAtiendeEnParalelo`.
const userConParalelo = (atiende_en_paralelo: boolean): User => ({ atiende_en_paralelo } as unknown as User);

const profesional = (id: number, nombre: string, activo = true): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo, servicios: [] } as unknown as Profesional);

function montar(profesionales: Profesional[], atiendeEnParalelo = false) {
  useProfesionalStore.setState({ profesionales, loading: false, error: null });
  useAuthStore.setState({ user: userConParalelo(atiendeEnParalelo) });
  vi.mocked(profesionalService.getAll).mockResolvedValue(profesionales);
  return renderWithProviders(<ProfesionalesPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfesionalesPage — ajuste "atiende en paralelo" (PR 2d)', () => {
  it('hides the setting with a single active professional', async () => {
    montar([profesional(1, 'Ana')]);
    await screen.findByText('Ana');
    expect(screen.queryByRole('switch', { name: 'Atiende en paralelo' })).not.toBeInTheDocument();
  });

  it('shows it OFF by default with 2+ active professionals, with one hint line', async () => {
    montar([profesional(1, 'Ana'), profesional(2, 'Laura')], false);
    const toggle = await screen.findByRole('switch', { name: 'Atiende en paralelo' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Permite armar promos donde dos profesionales atienden a la clienta a la vez.')).toBeInTheDocument();
  });

  it('appears once a second professional becomes active, still OFF', async () => {
    montar([profesional(1, 'Ana'), profesional(2, 'Laura', false)], false);
    await screen.findByText('Ana');
    expect(screen.queryByRole('switch', { name: 'Atiende en paralelo' })).not.toBeInTheDocument();
  });

  it('turns it on and saves via PUT perfil', async () => {
    montar([profesional(1, 'Ana'), profesional(2, 'Laura')], false);
    vi.mocked(authService.updatePerfil).mockResolvedValue(userConParalelo(true));
    fireEvent.click(await screen.findByRole('switch', { name: 'Atiende en paralelo' }));
    await waitFor(() => expect(authService.updatePerfil).toHaveBeenCalledWith({ atiende_en_paralelo: true }));
  });

  it('names the blocking promos and keeps the setting on when turning it off is blocked (422)', async () => {
    montar([profesional(1, 'Ana'), profesional(2, 'Laura')], true);
    vi.mocked(authService.updatePerfil).mockRejectedValue({
      response: { data: {
        message: 'No podés apagar "Atiende en paralelo" mientras tengas promos en paralelo activas. Pasalas a secuencia primero.',
        code: 'promos_paralelas_activas',
        promos: [{ id: 1, nombre: 'Softgel + Semis' }],
      } },
    });
    const toggle = await screen.findByRole('switch', { name: 'Atiende en paralelo' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => expect(alertDialog).toHaveBeenCalledWith(expect.stringContaining('Softgel + Semis')));
    expect(screen.getByRole('switch', { name: 'Atiende en paralelo' })).toHaveAttribute('aria-checked', 'true');
  });
});
