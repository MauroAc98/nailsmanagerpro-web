import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import type { Servicio } from '@/services/servicioService';
import type { Historia } from '@/lib/historiaHistorias';
import { HistoriasFueraDePantalla } from './HistoriasFueraDePantalla';

function servicio(id: number): Servicio {
  return {
    id, user_id: 1, nombre: `Servicio ${id}`, duracion_minutos: 30, precio: '1500',
    activo: true, es_promo: false, orden: id, categoria_id: null, created_at: '', updated_at: '',
  };
}

describe('HistoriasFueraDePantalla · encabezado', () => {
  it('cada historia lleva su propio contador, la misma foto y la misma profesional que el preview', () => {
    const historias = [
      { id: 'a', titulo: 'Uñas', servicios: [servicio(1)] },
      { id: 'b', titulo: 'Pies', servicios: [servicio(2)] },
      { id: 'c', titulo: 'Cejas', servicios: [servicio(3)] },
    ] as Historia[];
    renderWithProviders(
      <HistoriasFueraDePantalla
        historias={historias}
        registrarCanvas={() => () => {}}
        reportarFit={vi.fn()}
        templateId="feature"
        fotos={['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']}
        titulo="Precios"
        nombreNegocio="Salón Luz"
        telefono={null}
        profesionalNombre="Ana"
        logoUrl="data:image/png;base64,eA=="
      />,
    );
    expect(screen.getAllByTestId('encabezado-serie').map(e => e.textContent)).toEqual(['1/3', '2/3', '3/3']);
    expect(screen.getAllByTestId('encabezado-foto')).toHaveLength(3);
    screen.getAllByTestId('encabezado-linea').forEach(l => expect(l.textContent).toMatch(/^Precios · con Ana · /));
  });
});
