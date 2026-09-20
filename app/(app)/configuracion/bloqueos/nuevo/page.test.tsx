import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/render';
import { resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import NuevoBloqueoPage from './page';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import type { CreateBloqueoAgendaDto } from '@/services/bloqueoAgendaService';
import type { Profesional } from '@/services/profesionalService';

function profesional(overrides: Partial<Profesional> = {}): Profesional {
  return {
    id: 1, nombre: 'Lucía', apellido: 'Gómez', nombre_completo: 'Lucía Gómez',
    color: '#D79EA4', activo: true,
    ...overrides,
  } as Profesional;
}

// `agregarBloqueo` es parte del state del store real — se pisa acá con un
// spy para capturar el payload sin mockear ningún módulo.
type AgregarBloqueoFn = (dto: CreateBloqueoAgendaDto) => Promise<{ success: boolean; message?: string }>;

function seedStore(agregarBloqueo: AgregarBloqueoFn = vi.fn(async () => ({ success: true }))) {
  useBloqueosAgendaStore.setState({ bloqueos: [], loading: false, error: null, agregarBloqueo });
  return agregarBloqueo;
}

beforeEach(() => {
  resetNavigationMock();
  seedStore();
  useProfesionalStore.setState({
    profesionales: [profesional()], loading: false, error: null,
    fetchProfesionales: async () => {},
  });
});

describe('NuevoBloqueoPage', () => {
  it('muestra un subtítulo que explica las dos formas de bloquear', () => {
    renderWithProviders(<NuevoBloqueoPage />);

    expect(screen.getByText(/una fecha completa, o solo un horario puntual/i)).toBeInTheDocument();
  });

  it('arranca en "Todo el día" (sin campos de horario) y al elegir "Un horario puntual" los muestra', () => {
    renderWithProviders(<NuevoBloqueoPage />);

    expect(screen.queryByLabelText(/desde/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Un horario puntual'));

    expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
  });

  it('la vista previa refleja profesional, fecha y "Todo el día" / rango horario a medida que cambia el form', () => {
    renderWithProviders(<NuevoBloqueoPage />);

    // Default: "Todo el salón" + todo el día.
    const preview = screen.getByTestId('preview-bloqueo');
    expect(preview).toHaveTextContent('Todo el salón');
    expect(preview).toHaveTextContent('Todo el día');

    fireEvent.click(screen.getByText('Lucía'));
    expect(preview).toHaveTextContent('Lucía Gómez');

    fireEvent.click(screen.getByText('Un horario puntual'));
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '18:00' } });

    expect(preview).toHaveTextContent('14:00 - 18:00');
  });

  it('envía hora_desde/hora_hasta null cuando queda en "Todo el día", aunque antes se hayan tipeado horarios', async () => {
    const agregarBloqueo = seedStore();
    renderWithProviders(<NuevoBloqueoPage />);

    fireEvent.click(screen.getByText('Un horario puntual'));
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '18:00' } });
    // Vuelve a "Todo el día" — los horarios tipeados no deben sobrevivir.
    fireEvent.click(screen.getByText('Todo el día'));

    fireEvent.click(screen.getByText('Bloquear fecha'));

    await waitFor(() => expect(agregarBloqueo).toHaveBeenCalledTimes(1));
    expect(agregarBloqueo).toHaveBeenCalledWith(expect.objectContaining({
      hora_desde: null,
      hora_hasta: null,
    }));
  });

  it('envía el rango horario cargado cuando queda en "Un horario puntual"', async () => {
    const agregarBloqueo = seedStore();
    renderWithProviders(<NuevoBloqueoPage />);

    fireEvent.click(screen.getByText('Lucía'));
    fireEvent.click(screen.getByText('Un horario puntual'));
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '18:00' } });

    fireEvent.click(screen.getByText('Bloquear fecha'));

    await waitFor(() => expect(agregarBloqueo).toHaveBeenCalledTimes(1));
    expect(agregarBloqueo).toHaveBeenCalledWith(expect.objectContaining({
      profesional_id: 1,
      hora_desde: '14:00',
      hora_hasta: '18:00',
    }));
  });

  it('no envía el rango incompleto: mantiene el submit inactivo hasta cargar ambos horarios', () => {
    renderWithProviders(<NuevoBloqueoPage />);

    fireEvent.click(screen.getByText('Un horario puntual'));
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '14:00' } });

    expect(screen.getByText('Bloquear fecha')).toBeDisabled();
  });
});
