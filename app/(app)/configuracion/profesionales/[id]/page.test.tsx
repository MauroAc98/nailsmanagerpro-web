import { describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';

vi.mock('next/navigation', async () => {
  const mock = (await import('@/test/mocks/nextNavigation')).nextNavigationMock;
  return { ...mock, useParams: () => ({ id: '1' }) };
});

import EditarProfesionalPage from './page';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import type { Profesional } from '@/services/profesionalService';

function profesional(overrides: Partial<Profesional> = {}): Profesional {
  return {
    id: 1, nombre: 'Carla', apellido: 'Ruiz', nombre_completo: 'Carla Ruiz',
    color: '#D79EA4', activo: true, servicios: [], avatar_url: null,
    dias_atencion: null, fondo_historia_url: null, historia_precios_template_id: null,
    historia_precios_fotos: [], historia_precios_nota: null, user_id: 1,
    ...overrides,
  } as Profesional;
}

describe('EditarProfesionalPage — rediseño en 3 secciones', () => {
  it('agrupa los campos en Identidad, Disponibilidad y Servicios, y sigue guardando con los mismos datos', async () => {
    const actualizarProfesional = vi.fn().mockResolvedValue({ success: true });
    useProfesionalStore.setState({
      profesionales: [profesional()],
      fetchProfesionales: async () => {},
      actualizarProfesional,
    });
    useServiciosStore.setState({ servicios: [], fetchServicios: async () => {} });

    renderWithProviders(<EditarProfesionalPage />);

    expect(await screen.findByText('Identidad')).toBeInTheDocument();
    expect(screen.getByText('Disponibilidad')).toBeInTheDocument();
    expect(screen.getByText('Servicios que puede realizar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Carla')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => expect(actualizarProfesional).toHaveBeenCalledWith(1, {
      nombre: 'Carla', apellido: 'Ruiz', color: '#D79EA4', activo: true,
      servicio_ids: [], dias_atencion: null,
    }));
  });
});
