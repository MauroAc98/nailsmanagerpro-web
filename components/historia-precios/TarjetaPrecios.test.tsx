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
      servicios={lista(3)}
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
        tokens={estiloFeature} servicios={lista(2)}
        onFitChange={onFitChange}
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

describe('TarjetaPrecios · sin encabezado (vive sobre la foto)', () => {
  it('la tarjeta no dibuja recuadro, título, línea, contador ni divisor de encabezado', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta({ nota: 'Seña del 50%' });
    for (const id of ['tarjeta-foto', 'tarjeta-icono', 'tarjeta-titulo', 'tarjeta-linea', 'tarjeta-serie', 'tarjeta-divisor']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(card().querySelector('svg')).toBeNull();
    expect(within(card()).queryByText('Lista de precios')).toBeNull();
  });
});

describe('TarjetaPrecios · reserva superior', () => {
  it('el contenedor empieza reservaSuperior px debajo del borde superior', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta({ reservaSuperior: 142, reservaInferior: 96 });
    const c = screen.getByTestId('tarjeta-contenedor');
    expect(c.style.top).toBe('142px');
    expect(c.style.bottom).toBe('96px');
  });

  it('sin reserva superior el contenedor arranca en el borde', () => {
    alturasPorNivel = [500, 400, 300, 250];
    renderTarjeta();
    expect(screen.getByTestId('tarjeta-contenedor').style.top).toBe('0px');
  });

  it('cambiar la reserva superior re-mide desde el nivel 0', () => {
    alturasPorNivel = [900, 800, 700, 650];
    const { onFitChange, rerender } = renderTarjeta({ reservaSuperior: 0 });
    expect(card().dataset.densidad).toBe('2');
    alturasPorNivel = [500, 400, 300, 250];
    rerender(<TarjetaPrecios tokens={estiloFeature} servicios={lista(3)} onFitChange={onFitChange} reservaSuperior={142} />);
    expect(card().dataset.densidad).toBe('0');
  });
});
