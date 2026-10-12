import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/render';

vi.mock('@/services/categoriaServicioService', () => ({
  categoriaServicioService: { getAll: vi.fn().mockResolvedValue([]) },
}));

import type { Servicio } from '@/services/servicioService';
import { ServiciosSheet } from './ServiciosSheet';

const servicio = (id: number, nombre: string): Servicio =>
  ({ id, user_id: 1, nombre, duracion_minutos: 30, precio: '5000', activo: true, es_promo: false, orden: id, categoria_id: null, created_at: '', updated_at: '' }) as Servicio;
const servicios = [servicio(1, 'Softgel'), servicio(2, 'Esmaltado')];

function setup(over: Partial<React.ComponentProps<typeof ServiciosSheet>> = {}) {
  const props = {
    open: true, onClose: vi.fn(), title: 'Servicios', servicios, selectedIds: [1],
    onConfirm: vi.fn(), ctaLabel: (n: number) => (n === 0 ? 'Ver todos' : `Ver ${n}`),
    todosLabel: 'Todos los servicios', ...over,
  };
  const utils = renderWithProviders(<ServiciosSheet {...props} />);
  return { props, ...utils };
}
const cta = () => screen.getByRole('button', { name: /^Ver / });

describe('ServiciosSheet', () => {
  it('muestra el título y el CTA con el conteo del borrador', async () => {
    setup();
    await screen.findByText('Esmaltado');
    expect(screen.getByText('Servicios')).toBeInTheDocument();
    expect(cta()).toHaveTextContent('Ver 1');
  });

  it('Cancelar cierra sin confirmar', async () => {
    const { props } = setup();
    await screen.findByText('Esmaltado');
    fireEvent.click(screen.getByText('Esmaltado'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('Limpiar vacía el borrador', async () => {
    setup();
    await screen.findByText('Esmaltado');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(cta()).toHaveTextContent('Ver todos');
  });

  it('confirmar llama onConfirm con el borrador y cierra', async () => {
    const { props } = setup();
    await screen.findByText('Esmaltado');
    fireEvent.click(screen.getByText('Esmaltado'));
    fireEvent.click(cta());
    expect(props.onConfirm).toHaveBeenCalledWith([1, 2]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('aviso muestra la nota y deshabilita el CTA', async () => {
    const { props } = setup({ aviso: ids => (ids.length > 0 ? 'Ojo con esto' : null) });
    await screen.findByText('Esmaltado');
    expect(screen.getByText('Ojo con esto')).toBeInTheDocument();
    expect(cta()).toBeDisabled();
    fireEvent.click(cta());
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.queryByText('Ojo con esto')).not.toBeInTheDocument();
    expect(cta()).not.toBeDisabled();
  });

  it('al reabrir el borrador vuelve a selectedIds', async () => {
    const { props, rerender } = setup();
    await screen.findByText('Esmaltado');
    fireEvent.click(screen.getByText('Esmaltado'));
    expect(cta()).toHaveTextContent('Ver 2');
    rerender(<ServiciosSheet {...props} open={false} />);
    rerender(<ServiciosSheet {...props} open />);
    await screen.findByText('Esmaltado');
    expect(cta()).toHaveTextContent('Ver 1');
  });

  it('cerrado no renderiza nada', () => {
    setup({ open: false });
    expect(screen.queryByText('Servicios')).not.toBeInTheDocument();
  });
});
