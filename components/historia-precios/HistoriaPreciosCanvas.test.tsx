import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { within } from '@testing-library/react';
import type { Servicio } from '@/services/servicioService';
import { TEMPLATES } from './catalogo';
import { HistoriaPreciosCanvas, FOOTER_RESERVA } from './HistoriaPreciosCanvas';

function servicio(id: number): Servicio {
  return {
    id, user_id: 1, nombre: `Servicio ${id}`, duracion_minutos: 30, precio: '1500',
    activo: true, es_promo: false, orden: id, categoria_id: null,
    created_at: '', updated_at: '',
  };
}

function renderCanvas(props: Partial<React.ComponentProps<typeof HistoriaPreciosCanvas>> = {}) {
  return renderWithProviders(
    <HistoriaPreciosCanvas
      templateId="feature"
      fotos={['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']}
      titulo="Precios"
      servicios={[servicio(1), servicio(2)]}
      nombreNegocio="Salón Luz"
      telefono="5491155550000"
      nivelDensidad={0}
      {...props}
    />,
  );
}

describe('HistoriaPreciosCanvas · pie', () => {
  it('renderiza el pie una sola vez, fuera de la tarjeta, con el nombre del negocio', () => {
    renderCanvas();
    expect(screen.getAllByText('Reservá tu turno')).toHaveLength(1);
    const pie = screen.getByTestId('historia-precios-pie');
    expect(within(pie).getByText('Salón Luz')).toBeTruthy();
    expect(within(pie).getByText(/^\+/)).toBeTruthy();
    expect(within(screen.getByTestId('tarjeta-card')).queryByText('Reservá tu turno')).toBeNull();
  });

  it('usa el nombre de la profesional elegida en lugar del negocio', () => {
    renderCanvas({ profesionalNombre: 'Ana' });
    const pie = screen.getByTestId('historia-precios-pie');
    expect(within(pie).getByText('Ana')).toBeTruthy();
    expect(within(pie).queryByText('Salón Luz')).toBeNull();
    expect(screen.getAllByText('Reservá tu turno')).toHaveLength(1);
  });

  it('sin teléfono muestra solo el nombre', () => {
    renderCanvas({ telefono: null });
    const pie = screen.getByTestId('historia-precios-pie');
    expect(within(pie).queryByText(/^\+/)).toBeNull();
    expect(within(pie).getByText('Salón Luz')).toBeTruthy();
  });

  it.each(TEMPLATES.map(t => [t.id, t.cardVariant]))('plantilla %s (%s): tarjeta y pie no se superponen', (id) => {
    renderCanvas({ templateId: id as never });
    // La tarjeta termina FOOTER_RESERVA px arriba del borde inferior.
    expect(screen.getByTestId('tarjeta-contenedor').style.bottom).toBe(`${FOOTER_RESERVA}px`);
    expect(screen.getAllByTestId('historia-precios-pie')).toHaveLength(1);
  });
});
