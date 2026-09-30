import { describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import NuevoProfesionalPage from './page';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { profesionalPalette } from '@/theme/colors';

describe('NuevoProfesionalPage — rediseño en 3 secciones', () => {
  it('agrupa los campos en Identidad, Disponibilidad y Servicios, y sigue guardando con los mismos datos', async () => {
    const agregarProfesional = vi.fn().mockResolvedValue({ success: true });
    useProfesionalStore.setState({ profesionales: [], agregarProfesional });
    useServiciosStore.setState({ servicios: [], fetchServicios: async () => {} });

    renderWithProviders(<NuevoProfesionalPage />);

    // Las 3 tarjetas por sentido están presentes.
    expect(screen.getByText('Identidad')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidad')).toBeInTheDocument();
    expect(screen.getByText('Servicios que puede realizar')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: Sofía'), { target: { value: 'Carla' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Gómez'), { target: { value: 'Ruiz' } });
    fireEvent.click(screen.getByText('Agregar profesional'));

    await waitFor(() => expect(agregarProfesional).toHaveBeenCalledWith({
      nombre: 'Carla', apellido: 'Ruiz', color: profesionalPalette[0], servicio_ids: [], dias_atencion: null,
    }));
  });
});
