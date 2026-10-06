import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import type { Servicio } from '@/services/servicioService';
import type { CategoriaServicio } from '@/services/categoriaServicioService';
import { SeleccionServicios, MAX_SERVICIOS_POR_HISTORIA } from './SeleccionServicios';

function servicio(overrides: Partial<Servicio>): Servicio {
  return {
    id: 1, user_id: 1, nombre: 'Servicio', duracion_minutos: 30, precio: '1500',
    activo: true, es_promo: false, orden: 0, categoria_id: null,
    created_at: '', updated_at: '', ...overrides,
  };
}
const categorias = [{ id: 10, nombre: 'Uñas' }, { id: 20, nombre: 'Pies' }] as CategoriaServicio[];
const servicios = [
  servicio({ id: 1, nombre: 'Esmaltado', categoria_id: 10 }),
  servicio({ id: 2, nombre: 'Kapping', categoria_id: 10, es_promo: true }),
  servicio({ id: 3, nombre: 'Pedicura', categoria_id: 20 }),
  servicio({ id: 4, nombre: 'Cejas', categoria_id: null }),
];

function setup(excluidos: number[] = [], lista = servicios) {
  const onChange = vi.fn();
  renderWithProviders(
    <SeleccionServicios servicios={lista} categorias={categorias} excluidos={new Set(excluidos)} onChange={onChange} />,
  );
  return onChange;
}
const ids = (call: unknown) => [...(call as Set<number>)].sort();
const checkboxCategoria = (nombre: string) =>
  screen.getByRole('button', { name: `Marcar todos los servicios de ${nombre}` });

describe('SeleccionServicios', () => {
  it('muestra el contador y las categorías colapsadas, "Sin categoría" al final', () => {
    setup([1]);
    expect(screen.getByText(/3 de 4 servicios elegidos/)).toBeTruthy();
    const filas = screen.getAllByRole('button', { expanded: false });
    expect(filas.map(f => f.textContent)).toEqual([
      expect.stringContaining('Uñas'), expect.stringContaining('Pies'), expect.stringContaining('Sin categoría'),
    ]);
    expect(screen.queryByText('Esmaltado')).toBeNull();
  });

  it('expandir y colapsar una categoría muestra y oculta sus servicios', () => {
    setup();
    const fila = screen.getByRole('button', { name: /Uñas/, expanded: false });
    fireEvent.click(fila);
    expect(screen.getByText('Esmaltado')).toBeTruthy();
    expect(fila.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(fila);
    expect(screen.queryByText('Esmaltado')).toBeNull();
  });

  it('un servicio expandido alterna su exclusión y expone aria-pressed', () => {
    const onChange = setup([2]);
    fireEvent.click(screen.getByRole('button', { name: /Uñas/, expanded: false }));
    expect(screen.getByRole('button', { name: /Esmaltado/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Kapping/ }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Esmaltado/ }));
    expect(ids(onChange.mock.calls[0][0])).toEqual([1, 2]);
  });

  it('muestra el chip PROMO solo en promociones y el precio', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Uñas/, expanded: false }));
    expect(screen.getAllByText('PROMO')).toHaveLength(1);
    expect(screen.getAllByText('$1.500').length).toBe(2);
  });

  it('checkbox de categoría con todo marcado: excluye toda la categoría', () => {
    const onChange = setup();
    expect(checkboxCategoria('Uñas').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(checkboxCategoria('Uñas'));
    expect(ids(onChange.mock.calls[0][0])).toEqual([1, 2]);
  });

  it('checkbox de categoría parcial: aria-pressed mixed y la marca entera', () => {
    const onChange = setup([1]);
    expect(checkboxCategoria('Uñas').getAttribute('aria-pressed')).toBe('mixed');
    fireEvent.click(checkboxCategoria('Uñas'));
    expect(ids(onChange.mock.calls[0][0])).toEqual([]);
  });

  it('checkbox de categoría vacía: la marca entera', () => {
    const onChange = setup([1, 2]);
    expect(checkboxCategoria('Uñas').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(checkboxCategoria('Uñas'));
    expect(ids(onChange.mock.calls[0][0])).toEqual([]);
  });

  it('tocar el checkbox de categoría no expande la fila', () => {
    setup();
    fireEvent.click(checkboxCategoria('Uñas'));
    expect(screen.queryByText('Esmaltado')).toBeNull();
  });

  it('"Quitar todo" excluye todo cuando todo está elegido', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar todo' }));
    expect(ids(onChange.mock.calls[0][0])).toEqual([1, 2, 3, 4]);
  });

  it('"Elegir todo" no excluye nada cuando falta alguno', () => {
    const onChange = setup([3]);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir todo' }));
    expect(ids(onChange.mock.calls[0][0])).toEqual([]);
  });

  it('muestra el hint de sin categoría solo si ese grupo existe', () => {
    setup();
    expect(screen.getByText(/Los servicios sin categoría aparecen juntos/)).toBeTruthy();
  });

  it('no muestra el hint sin grupo "Sin categoría"', () => {
    setup([], servicios.filter(s => s.categoria_id !== null));
    expect(screen.queryByText(/Los servicios sin categoría aparecen juntos/)).toBeNull();
  });

  it('no avisa por debajo del umbral', () => {
    setup();
    expect(screen.queryByText(/Son muchos servicios/)).toBeNull();
  });

  it('muestra la nota ámbar con más de MAX_SERVICIOS_POR_HISTORIA elegidos', () => {
    const muchos = Array.from({ length: MAX_SERVICIOS_POR_HISTORIA + 1 }, (_, i) =>
      servicio({ id: 100 + i, nombre: `S${i}`, categoria_id: 10 }));
    setup([], muchos);
    expect(screen.getByText(/Son muchos servicios/)).toBeTruthy();
  });

  it('no avisa con exactamente el umbral', () => {
    const justos = Array.from({ length: MAX_SERVICIOS_POR_HISTORIA }, (_, i) =>
      servicio({ id: 100 + i, nombre: `S${i}`, categoria_id: 10 }));
    setup([], justos);
    expect(screen.queryByText(/Son muchos servicios/)).toBeNull();
  });
});
