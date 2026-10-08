import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));

import type { Servicio } from '@/services/servicioService';
import { SelectorServicios } from './SelectorServicios';

const servicio = (id: number, nombre: string, duracion_minutos: number): Servicio =>
  ({ id, user_id: 1, nombre, duracion_minutos, precio: '5000', activo: true, es_promo: false, orden: id, categoria_id: null, created_at: '', updated_at: '' }) as Servicio;

describe('SelectorServicios — duración', () => {
  const servicios = [
    servicio(1, 'Softgel', 90),
    servicio(2, 'Esmaltado', 45),
    servicio(3, 'Pedicura', 120),
    servicio(4, 'Retiro', 60),
  ];

  it('muestra la duración en horas y minutos, como se lee de siempre, no en minutos totales', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} />);

    expect(await screen.findByText('1 h 30 min')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('2 h')).toBeInTheDocument();
    expect(screen.getByText('1 h')).toBeInTheDocument();
  });

  it('no queda ningún "90 min" ni "120 min" en minutos totales', async () => {
    renderWithProviders(<SelectorServicios servicios={servicios} mode="multi" selectedIds={[]} onChange={vi.fn()} />);
    await screen.findByText('Softgel');

    expect(screen.queryByText('90 min')).not.toBeInTheDocument();
    expect(screen.queryByText('120 min')).not.toBeInTheDocument();
    expect(screen.queryByText('60 min')).not.toBeInTheDocument();
  });
});
