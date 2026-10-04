import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import ProfesionalesPage from './page';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import type { Profesional } from '@/services/profesionalService';

function seedProfesionales(profesionales: Profesional[]): void {
  useProfesionalStore.setState({
    profesionales, loading: false, error: null,
    fetchProfesionales: async () => {},
  });
}

function profesional(overrides: Partial<Profesional> = {}): Profesional {
  return {
    id: 1, nombre: 'Lucía', apellido: 'Gómez', nombre_completo: 'Lucía Gómez',
    color: '#D79EA4', activo: true, servicios: [], avatar_url: null,
    dias_atencion: null,
    ...overrides,
  } as Profesional;
}

describe('ProfesionalesPage — rediseño del card', () => {
  it('con avatar_url, muestra la foto real en vez de las iniciales', () => {
    seedProfesionales([profesional({ avatar_url: 'https://cdn.turnetto.com/avatar.jpg' })]);
    renderWithProviders(<ProfesionalesPage />);
    const foto = screen.getAllByAltText('').find(img => (img as HTMLImageElement).src.includes('avatar.jpg'));
    expect(foto).toBeDefined();
    expect(screen.queryByText('LG')).not.toBeInTheDocument();
  });

  it('sin avatar_url, muestra las iniciales de nombre+apellido (no solo la primera letra del nombre)', () => {
    seedProfesionales([profesional({ avatar_url: null })]);
    renderWithProviders(<ProfesionalesPage />);
    expect(screen.getByText('LG')).toBeInTheDocument();
  });

  it('la jefa (menor id entre las activas) muestra el badge de jefa; las demás no', () => {
    seedProfesionales([
      profesional({ id: 5, nombre: 'Rocío', apellido: 'Diaz', nombre_completo: 'Rocío Diaz' }),
      profesional({ id: 2, nombre: 'Lucía', apellido: 'Gómez', nombre_completo: 'Lucía Gómez' }),
    ]);
    renderWithProviders(<ProfesionalesPage />);
    expect(screen.getAllByLabelText('Titular')).toHaveLength(1);
  });

  it('una profesional inactiva muestra el pill "Inactiva"', () => {
    seedProfesionales([profesional({ activo: false })]);
    renderWithProviders(<ProfesionalesPage />);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('una profesional activa no muestra el pill "Inactiva"', () => {
    seedProfesionales([profesional({ activo: true })]);
    renderWithProviders(<ProfesionalesPage />);
    expect(screen.queryByText('Inactiva')).not.toBeInTheDocument();
  });

  it('sin restricción de días (dias_atencion null), muestra "Todos los días" junto a la cantidad de servicios', () => {
    seedProfesionales([profesional({ dias_atencion: null, servicios: [{ id: 1 }] as never })]);
    renderWithProviders(<ProfesionalesPage />);
    expect(screen.getByText(/Todos los días/)).toBeInTheDocument();
    expect(screen.getByText(/1 servicio/)).toBeInTheDocument();
  });

  it('con días puntuales, muestra el rango colapsado ("Lun a Vie")', () => {
    seedProfesionales([profesional({ dias_atencion: [1, 2, 3, 4, 5] })]);
    renderWithProviders(<ProfesionalesPage />);
    expect(screen.getByText(/Lun a Vie/)).toBeInTheDocument();
  });
});
