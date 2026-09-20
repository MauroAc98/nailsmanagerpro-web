import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import BloqueosPage from './page';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import type { BloqueoAgenda } from '@/services/bloqueoAgendaService';
import type { Profesional } from '@/services/profesionalService';

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

    expect(screen.getByText(/no van a poder reservarlos online/i)).toBeInTheDocument();
  });

  it('un bloqueo de todo el negocio sin horario muestra el ícono de local y las pills "Todo el negocio" / "Todo el día"', () => {
    seedBloqueos([bloqueo({ profesional_id: null, hora_desde: null, hora_hasta: null })]);

    renderWithProviders(<BloqueosPage />);

    expect(screen.getByTestId('icono-local')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-profesional')).not.toBeInTheDocument();
    expect(screen.getByText('Todo el negocio')).toBeInTheDocument();
    const pillHorario = screen.getByTestId('pill-horario');
    expect(pillHorario).toHaveTextContent('Todo el día');
  });

  it('un bloqueo de una profesional con horario puntual muestra sus iniciales y las pills de nombre + rango horario en ámbar', () => {
    seedProfesionales([profesional()]);
    seedBloqueos([bloqueo({ profesional_id: 1, hora_desde: '14:00', hora_hasta: '18:00' })]);

    renderWithProviders(<BloqueosPage />);

    expect(screen.queryByTestId('icono-local')).not.toBeInTheDocument();
    const avatar = screen.getByTestId('avatar-profesional');
    expect(avatar).toHaveTextContent('LG');
    expect(screen.getByText('Lucía Gómez')).toBeInTheDocument();
    const pillHorario = screen.getByTestId('pill-horario');
    expect(pillHorario).toHaveTextContent('14:00 - 18:00');
    expect(pillHorario).toHaveStyle({ backgroundColor: 'var(--ag-amber-bg)' });
  });

  it('el estado vacío explica el uso del feature (vacaciones/feriados)', () => {
    renderWithProviders(<BloqueosPage />);

    expect(screen.getByText(/vacaciones|feriado/i)).toBeInTheDocument();
  });
});
