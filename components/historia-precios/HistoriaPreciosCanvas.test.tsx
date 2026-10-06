import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { within } from '@testing-library/react';
import type { Servicio } from '@/services/servicioService';
import { TEMPLATES } from './catalogo';
import { HistoriaPreciosCanvas, FOOTER_RESERVA, BASE_HEIGHT } from './HistoriaPreciosCanvas';
import { reservaSuperiorEncabezado, alturaZonaEncabezado } from './EncabezadoHistoria';

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

  it('el pie es siempre el negocio, aunque haya profesional; ella va solo en el encabezado', () => {
    renderCanvas({ profesionalNombre: 'Ana' });
    const pie = screen.getByTestId('historia-precios-pie');
    expect(within(pie).getByText('Salón Luz')).toBeTruthy();
    expect(within(pie).queryByText('Ana')).toBeNull();
    expect(screen.getByTestId('encabezado-linea').textContent).toMatch(/^con Ana · /);
    expect(screen.getAllByText('Reservá tu turno')).toHaveLength(1);
  });

  it('sin teléfono muestra solo el nombre', () => {
    renderCanvas({ telefono: null });
    const pie = screen.getByTestId('historia-precios-pie');
    expect(within(pie).queryByText(/^\+/)).toBeNull();
    expect(within(pie).getByText('Salón Luz')).toBeTruthy();
  });

  it.each(TEMPLATES.map(t => [t.id, t.cardVariant]))('plantilla %s (%s): tarjeta, encabezado y pie no se superponen', (id) => {
    renderCanvas({ templateId: id as never });
    // La tarjeta termina FOOTER_RESERVA px arriba del borde inferior.
    expect(screen.getByTestId('tarjeta-contenedor').style.bottom).toBe(`${FOOTER_RESERVA}px`);
    // ...y empieza debajo de la zona del encabezado.
    expect(screen.getByTestId('tarjeta-contenedor').style.top).toBe(`${reservaSuperiorEncabezado(BASE_HEIGHT)}px`);
    expect(screen.getAllByTestId('encabezado-historia')).toHaveLength(1);
    expect(screen.getAllByTestId('historia-precios-pie')).toHaveLength(1);
  });
});

describe('HistoriaPreciosCanvas · subtítulo', () => {
  it('pasa el subtítulo al encabezado', () => {
    renderCanvas({ subtitulo: 'Pies' });
    expect(screen.getByTestId('encabezado-titulo').textContent).toBe('Pies');
  });
  it('sin subtítulo el título es "Precios" y la línea no arranca con "con"', () => {
    renderCanvas();
    expect(screen.getByTestId('encabezado-titulo').textContent).toBe('Precios');
    expect(screen.getByTestId('encabezado-linea').textContent).not.toMatch(/^con /);
  });
});

describe('HistoriaPreciosCanvas · encabezado sobre la foto', () => {
  it('pasa la foto, la profesional y la serie al encabezado, una sola vez y fuera de la tarjeta; el pie sigue siendo el negocio', () => {
    renderCanvas({ subtitulo: 'Pies', profesionalNombre: 'Ana', logoUrl: 'data:image/png;base64,eA==', serie: { actual: 2, total: 5 } });
    expect(screen.getAllByTestId('encabezado-historia')).toHaveLength(1);
    expect(within(screen.getByTestId('tarjeta-card')).queryByTestId('encabezado-historia')).toBeNull();
    expect((screen.getByTestId('encabezado-foto') as HTMLImageElement).getAttribute('src')).toBe('data:image/png;base64,eA==');
    expect(screen.getByTestId('encabezado-serie').textContent).toBe('2/5');
    expect(screen.getByTestId('encabezado-linea').textContent).toMatch(/^Precios · con Ana · /);
    expect(screen.getByTestId('encabezado-titulo').style.color).toBe('rgb(255, 255, 255)');
    expect(within(screen.getByTestId('historia-precios-pie')).getByText('Salón Luz')).toBeTruthy();
  });

  it('la franja superior tiene el alto de la zona del encabezado, con degradé oscuro encima', () => {
    renderCanvas();
    const banda = screen.getByTestId('historia-precios-banda');
    expect(banda.style.height).toBe(`${alturaZonaEncabezado(BASE_HEIGHT)}px`);
    expect(banda.style.overflow).toBe('hidden');
    const degradado = screen.getByTestId('historia-precios-degradado');
    expect(degradado.style.height).toBe(`${alturaZonaEncabezado(BASE_HEIGHT)}px`);
    expect(degradado.style.background).toContain('linear-gradient');
    expect(degradado.style.background).toContain('0.62');
  });

  it('la franja repite la foto a tamaño completo con blur(16px), alineada con la base', () => {
    renderCanvas({ templateId: 'feature' });
    const copia = screen.getByTestId('historia-precios-banda-copia');
    expect(copia.style.filter).toBe('blur(16px)');
    expect(copia.style.width).toBe('420px');
    expect(copia.style.height).toBe(`${BASE_HEIGHT}px`);
    expect(copia.style.top).toBe('0px');
    expect(copia.querySelector('img')).toBeTruthy();
    // Una foto base + una copia desenfocada (la tarjeta no pinta fotos).
    expect(document.querySelectorAll('img[src="a.jpg"]')).toHaveLength(2);
  });

  it.each(TEMPLATES.map(t => [t.id]))('plantilla %s: la copia desenfocada no duplica la tarjeta ni el encabezado', (id) => {
    renderCanvas({ templateId: id as never });
    expect(screen.getAllByTestId('tarjeta-card')).toHaveLength(1);
    expect(screen.getAllByTestId('encabezado-historia')).toHaveLength(1);
    expect(screen.getByTestId('historia-precios-banda-copia').style.filter).toBe('blur(16px)');
  });

  it('en miniaturas (sinFranjaDesenfocada) queda el degradé pero no la copia de la foto', () => {
    renderCanvas({ sinFranjaDesenfocada: true });
    expect(screen.queryByTestId('historia-precios-banda')).toBeNull();
    expect(screen.queryByTestId('historia-precios-banda-copia')).toBeNull();
    expect(screen.getByTestId('historia-precios-degradado')).toBeTruthy();
    expect(screen.getAllByTestId('encabezado-historia')).toHaveLength(1);
  });
});
