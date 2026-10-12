import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/store/useConfirmStore', () => ({
  confirmDialog: vi.fn(),
  alertDialog: vi.fn(),
}));

import BloqueosPage from './page';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import type { BloqueoAgenda } from '@/services/bloqueoAgendaService';
import type { Profesional } from '@/services/profesionalService';
import { confirmDialog } from '@/store/useConfirmStore';

// Ambos stores exponen sus fetch* como parte del state — se pisan acá con
// no-ops para que el useEffect de montaje no dispare un fetch real (sin
// mockear ningún módulo, mismo objeto de store real).
function seedBloqueos(bloqueos: BloqueoAgenda[]): void {
  useBloqueosAgendaStore.setState({
    bloqueos, loading: false, error: null,
    fetchBloqueos: async () => {},
  });
}

function seedProfesionales(profesionales: Profesional[]): void {
  useProfesionalStore.setState({
    profesionales, loading: false, error: null,
    fetchProfesionales: async () => {},
  });
}

function profesional(overrides: Partial<Profesional> = {}): Profesional {
  return {
    id: 1, nombre: 'Lucía', apellido: 'Gómez', nombre_completo: 'Lucía Gómez',
    color: '#D79EA4', activo: true,
    ...overrides,
  } as Profesional;
}

function bloqueo(overrides: Partial<BloqueoAgenda> = {}): BloqueoAgenda {
  return {
    id: 1, user_id: 1, profesional_id: null, fecha: '2026-12-25',
    hora_desde: null, hora_hasta: null, motivo: null,
    created_at: '', updated_at: '',
    ...overrides,
  };
}

beforeEach(() => {
  resetNavigationMock();
  seedBloqueos([]);
  seedProfesionales([]);
});

describe('BloqueosPage', () => {
  it('muestra un subtítulo que explica qué hace un bloqueo', () => {
    renderWithProviders(<BloqueosPage />);

    expect(screen.getByText(/dejan de figurar como disponibles para tus clientes/i)).toBeInTheDocument();
  });

  it('un bloqueo de todo el negocio sin horario muestra el ícono de local y "Todo el negocio" / "Todo el día"', () => {
    seedBloqueos([bloqueo({ profesional_id: null, hora_desde: null, hora_hasta: null })]);

    renderWithProviders(<BloqueosPage />);

    expect(screen.getByTestId('icono-local')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-profesional')).not.toBeInTheDocument();
    expect(screen.getByText('Todo el negocio')).toBeInTheDocument();
    expect(screen.getByTestId('horario-bloqueo')).toHaveTextContent('Todo el día');
  });

  it('un bloqueo de una profesional con horario puntual muestra sus iniciales, el nombre y el rango horario en ámbar', () => {
    seedProfesionales([profesional()]);
    seedBloqueos([bloqueo({ profesional_id: 1, hora_desde: '14:00', hora_hasta: '18:00' })]);

    renderWithProviders(<BloqueosPage />);

    expect(screen.queryByTestId('icono-local')).not.toBeInTheDocument();
    const avatar = screen.getByTestId('avatar-profesional');
    expect(avatar).toHaveTextContent('LG');
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
    const horario = screen.getByTestId('horario-bloqueo');
    expect(horario).toHaveTextContent('14:00 - 18:00');
    expect(horario).toHaveStyle({ color: 'var(--ag-amber-fg)' });
  });

  it('el estado vacío explica el uso del feature (vacaciones/feriados)', () => {
    renderWithProviders(<BloqueosPage />);

    expect(screen.getByText(/vacaciones|feriado/i)).toBeInTheDocument();
  });

  it('eliminar desde el panel pide confirmación y llama al store', async () => {
    const eliminarBloqueo = vi.fn().mockResolvedValue({ success: true });
    useBloqueosAgendaStore.setState({ eliminarBloqueo });
    vi.mocked(confirmDialog).mockResolvedValue(true);
    seedBloqueos([bloqueo({ id: 7 })]);

    renderWithProviders(<BloqueosPage />);
    fireEvent.click(screen.getByText('ELIMINAR'));

    await waitFor(() => expect(eliminarBloqueo).toHaveBeenCalledWith(7));
    expect(confirmDialog).toHaveBeenCalled();
  });

  it('si se cancela la confirmación no se elimina', async () => {
    const eliminarBloqueo = vi.fn();
    useBloqueosAgendaStore.setState({ eliminarBloqueo });
    vi.mocked(confirmDialog).mockResolvedValue(false);
    seedBloqueos([bloqueo({ id: 7 })]);

    renderWithProviders(<BloqueosPage />);
    fireEvent.click(screen.getByText('ELIMINAR'));

    await waitFor(() => expect(confirmDialog).toHaveBeenCalled());
    expect(eliminarBloqueo).not.toHaveBeenCalled();
  });
});
