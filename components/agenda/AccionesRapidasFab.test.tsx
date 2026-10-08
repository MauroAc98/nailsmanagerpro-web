import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/render';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import { routerMock, resetNavigationMock } from '@/test/mocks/nextNavigation';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { AccionesRapidasFab } from './AccionesRapidasFab';

const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Acciones rápidas' }));

beforeEach(() => {
  resetNavigationMock();
  usePendientesDeCobroStore.setState({ pendientes: [], error: null });
});

describe('AccionesRapidasFab', () => {
  it('cerrado solo muestra el boton, sin acciones', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);

    expect(screen.getByRole('button', { name: 'Acciones rápidas' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Nuevo turno' })).not.toBeInTheDocument();
  });

  it('al abrir ofrece nuevo turno y las tres acciones de finanzas', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);
    abrir();

    expect(screen.getByRole('button', { name: 'Acciones rápidas' })).toHaveAttribute('aria-expanded', 'true');
    for (const nombre of ['Nuevo turno', 'Cargar gasto', 'Cargar ingreso', 'Cobrar turnos']) {
      expect(screen.getByRole('button', { name: new RegExp(nombre) })).toBeInTheDocument();
    }
  });

  it('en fecha pasada o con filtro (sin nuevo turno) deja solo las acciones de finanzas', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2020-01-01" mostrarNuevoTurno={false} />);
    abrir();

    expect(screen.queryByRole('button', { name: 'Nuevo turno' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar gasto' })).toBeInTheDocument();
  });

  it.each([
    ['Nuevo turno', '/agenda/nuevo?fecha=2099-06-10'],
    ['Cargar gasto', '/configuracion/gastos/nuevo'],
    ['Cargar ingreso', '/configuracion/ingresos/nuevo'],
    ['Cobrar turnos', '/configuracion/cobros'],
  ])('"%s" navega a %s y cierra el menu', (nombre, ruta) => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(nombre) }));

    expect(routerMock.push).toHaveBeenCalledWith(ruta);
    expect(screen.getByRole('button', { name: 'Acciones rápidas' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('cobrar turnos muestra cuantos turnos hay por cobrar', () => {
    usePendientesDeCobroStore.setState({ pendientes: [{ id: 1 }, { id: 2 }, { id: 3 }] as never, error: null });
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);
    abrir();

    expect(screen.getByRole('button', { name: /Cobrar turnos/ })).toHaveTextContent('3');
  });

  it('sin turnos por cobrar no muestra contador', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);
    abrir();

    expect(screen.getByRole('button', { name: /Cobrar turnos/ })).not.toHaveTextContent(/\d/);
  });

  it('el fondo y el menu aparecen y se van con un fundido, no de golpe', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);
    const fondo = screen.getByTestId('acciones-fondo');
    const menu = screen.getByTestId('acciones-menu');

    expect(fondo).toHaveStyle({ opacity: '0' });
    expect(fondo.style.transition).toContain('opacity');
    expect(menu.style.transition).toContain('opacity');

    abrir();
    expect(fondo).toHaveStyle({ opacity: '1' });
    expect(menu).toHaveStyle({ opacity: '1' });
  });

  it('el color del fondo viene del tema (oscuro en claro y en oscuro), no del color del texto', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);

    expect(screen.getByTestId('acciones-fondo').style.backgroundColor).toBe('var(--ag-scrim)');
  });

  it('cerrado, el menu no queda al alcance del teclado ni de los lectores de pantalla', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);

    expect(screen.getByTestId('acciones-menu').parentElement).toHaveAttribute('aria-hidden', 'true');
    abrir();
    expect(screen.getByTestId('acciones-menu').parentElement).toHaveAttribute('aria-hidden', 'false');
  });

  it('tocar el fondo o Escape cierra el menu sin navegar', () => {
    renderWithProviders(<AccionesRapidasFab fechaSeleccionada="2099-06-10" mostrarNuevoTurno />);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('button', { name: 'Acciones rápidas' })).toHaveAttribute('aria-expanded', 'false');

    abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Acciones rápidas' })).toHaveAttribute('aria-expanded', 'false');
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
