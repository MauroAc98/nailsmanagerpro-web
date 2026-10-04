import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';

// The "Cargar horarios" link opens this page with ?profesional=<id>: it is a
// one-time seed for the selector (valid only for an ACTIVE professional).
vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/services/profesionalService', async (orig) => ({
  ...(await orig<typeof import('@/services/profesionalService')>()),
  profesionalService: { getAll: vi.fn() },
}));
vi.mock('@/services/slotService', () => ({ slotService: { getAll: vi.fn().mockResolvedValue([]) } }));

import { profesionalService, type Profesional } from '@/services/profesionalService';
import { slotService } from '@/services/slotService';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';
import SlotsPage from '@/app/(app)/configuracion/slots/page';

const prof = (id: number, nombre: string, activo = true): Profesional =>
  ({ id, user_id: 1, nombre, apellido: null, nombre_completo: nombre, color: null, activo, servicios: [] } as unknown as Profesional);

const ana = prof(1, 'Ana');
const laura = prof(2, 'Laura');
const marta = prof(3, 'Marta', false);

function montar(search: string) {
  setMockLocation('/configuracion/slots', search);
  useProfesionalStore.setState({ profesionales: [ana, laura, marta] });
  vi.mocked(profesionalService.getAll).mockResolvedValue([ana, laura, marta]);
  return renderWithProviders(<SlotsPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetNavigationMock();
  vi.mocked(slotService.getAll).mockResolvedValue([]);
});

describe('SlotsPage — ?profesional seed', () => {
  it('preselects the seeded active professional', async () => {
    montar('profesional=2');
    await waitFor(() => expect(slotService.getAll).toHaveBeenCalledWith(2));
    expect(slotService.getAll).not.toHaveBeenCalledWith(1);
  });

  it('ignores an id that is not an active professional', async () => {
    montar('profesional=3');
    await waitFor(() => expect(slotService.getAll).toHaveBeenCalledWith(1));
    expect(slotService.getAll).not.toHaveBeenCalledWith(3);
  });

  it('ignores a malformed value', async () => {
    montar('profesional=abc');
    await waitFor(() => expect(slotService.getAll).toHaveBeenCalledWith(1));
  });

  it('defaults to the jefa without the param', async () => {
    montar('');
    await waitFor(() => expect(slotService.getAll).toHaveBeenCalledWith(1));
    expect(screen.getByText('Laura')).toBeInTheDocument();
  });
});
