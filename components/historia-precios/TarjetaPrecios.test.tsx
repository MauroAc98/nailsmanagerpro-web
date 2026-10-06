import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { within } from '@testing-library/react';
import type { Servicio } from '@/services/servicioService';
import { estiloFeature } from './estilos';
import { TarjetaPrecios } from './TarjetaPrecios';
import { NIVELES_DENSIDAD } from '@/lib/historiaDensidad';


function servicio(id: number, overrides: Partial<Servicio> = {}): Servicio {
  return {
    id, user_id: 1, nombre: `Servicio ${id}`, duracion_minutos: 30, precio: '1500',
    activo: true, es_promo: false, orden: id, categoria_id: null,
    created_at: '', updated_at: '', ...overrides,
  };
}
const lista = (n: number) => Array.from({ length: n }, (_, i) => servicio(i + 1));

// jsdom no hace layout: simulamos el alto natural de la tarjeta según el
// nivel de densidad con que está renderizada (data-densidad) y un alto de
// contenedor fijo (747 - 36 de padding = 711 disponibles).
let alturasPorNivel: number[] = [];
let medidas: number[] = [];

beforeEach(() => {
  medidas = [];
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.dataset.testid === 'tarjeta-card') {
        const nivel = Number(this.dataset.densidad);
        medidas.push(nivel);
        return alturasPorNivel[nivel];
      }
      return 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === 'tarjeta-contenedor' ? 747 : 0;
    },
  });
});

afterEach(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

function renderTarjeta(props: Partial<React.ComponentProps<typeof TarjetaPrecios>> = {}) {
  const onFitChange = vi.fn();
  const utils = renderWithProviders(
    <TarjetaPrecios
      tokens={estiloFeature}
      titulo="Precios"
      servicios={lista(3)}
      nombreNegocio="Salón"
      onFitChange={onFitChange}
      {...props}
    />,
  );
  return { onFitChange, ...utils };
}
const card = () => screen.getByTestId('tarjeta-card');

describe('TarjetaPrecios · ajuste al contenido', () => {
  it('queda en el nivel 0 si entra cómodo', () => {
    alturasPorNivel = [500, 400, 300, 250];
    const { onFitChange } = renderTarjeta();
    expect(card().dataset.densidad).toBe('0');
    expect(onFitChange).toHaveBeenLastCalledWith({ nivel: 0, entra: true });
  });

  it('baja de nivel hasta el primero que entra y mide solo hasta ahí', () => {
    alturasPorNivel = [900, 800, 700, 650];
    const { onFitChange } = renderTarjeta();
    expect(card().dataset.densidad).toBe('2');
    expect(onFitChange).toHaveBeenLastCalledWith({ nivel: 2, entra: true });
    expect(medidas).toEqual([0, 1, 2]);
  });

  it('si no entra ni en el último nivel, queda ahí y reporta entra=false', () => {
    alturasPorNivel = [1200, 1100, 1000, 900];
    const { onFitChange } = renderTarjeta({ servicios: lista(30) });
    expect(card().dataset.densidad).toBe(String(NIVELES_DENSIDAD.length - 1));
    expect(onFitChange).toHaveBeenLastCalledWith({ nivel: NIVELES_DENSIDAD.length - 1, entra: false });
    // no recorta en silencio: la fila más chica respeta el piso
    expect(onFitChange).toHaveBeenCalledTimes(1);
  });

  it('re-mide desde el nivel 0 cuando cambia el contenido', () => {
    alturasPorNivel = [900, 800, 700, 650];
    const { onFitChange, rerender } = renderTarjeta();
    expect(card().dataset.densidad).toBe('2');
    alturasPorNivel = [500, 400, 300, 250];
    rerender(
      <TarjetaPrecios
        tokens={estiloFeature} titulo="Precios" servicios={lista(2)}
        nombreNegocio="Salón" onFitChange={onFitChange}
      />,
    );
    expect(card().dataset.densidad).toBe('0');
    expect(onFitChange).toHaveBeenLastCalledWith({ nivel: 0, entra: true });
  });

  it('con nivelDensidad controlado no mide ni reporta (miniaturas)', () => {
    alturasPorNivel = [900, 800, 700, 650];
    const { onFitChange } = renderTarjeta({ nivelDensidad: 3 });
    expect(card().dataset.densidad).toBe('3');
    expect(medidas).toEqual([]);
    expect(onFitChange).not.toHaveBeenCalled();
  });

  it('aplica el piso de fuente en las filas del nivel más compacto', () => {
    alturasPorNivel = [1200, 1100, 1000, 900];
    renderTarjeta();
    const fila = screen.getByText('Servicio 1');
    expect(parseFloat(fila.style.fontSize)).toBeGreaterThanOrEqual(12);
  });
});

describe('TarjetaPrecios · pie fuera de la tarjeta', () => {
  it('no renderiza CTA ni teléfono dentro de la tarjeta; la nota sigue al pie', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta({ nota: 'Seña del 50%' });
    expect(screen.queryByText('Reservá tu turno')).toBeNull();
    expect(screen.queryByText('123')).toBeNull();
    expect(within(card()).getByText('Seña del 50%')).toBeTruthy();
  });

  it('reserva la zona del pie: el contenedor termina arriba de ella', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta({ reservaInferior: 96 });
    expect(screen.getByTestId('tarjeta-contenedor').style.bottom).toBe('96px');
  });

  it('sin reserva el contenedor llega al borde inferior', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta();
    expect(screen.getByTestId('tarjeta-contenedor').style.bottom).toBe('0px');
  });
});

describe('TarjetaPrecios · subtítulo de categoría', () => {
  it('sin subtitulo no renderiza nada extra', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta();
    expect(screen.queryByTestId('tarjeta-subtitulo')).toBeNull();
  });

  it('con subtitulo lo muestra bajo el título, en mayúsculas', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta({ subtitulo: 'Pies' });
    const sub = screen.getByTestId('tarjeta-subtitulo');
    expect(sub.textContent).toBe('Pies');
    expect(sub.style.textTransform).toBe('uppercase');
    expect(sub.style.fontSize).toBe('10px');
  });

  it('forma parte del contenido medido: cambiarlo re-mide desde el nivel 0', () => {
    alturasPorNivel = [900, 800, 700, 650];
    const { onFitChange, rerender } = renderTarjeta({ subtitulo: 'Pies' });
    expect(card().dataset.densidad).toBe('2');
    alturasPorNivel = [500, 400, 300, 250];
    rerender(
      <TarjetaPrecios
        tokens={estiloFeature} titulo="Precios" servicios={lista(3)} subtitulo="Uñas"
        nombreNegocio="Salón" onFitChange={onFitChange}
      />,
    );
    expect(card().dataset.densidad).toBe('0');
  });
});
