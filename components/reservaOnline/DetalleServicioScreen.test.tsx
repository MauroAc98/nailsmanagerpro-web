import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { DetalleServicioScreen } from './DetalleServicioScreen';
import { limpiarFlujo, prepararServicio } from './testUtils';

describe('DetalleServicioScreen', () => {
  beforeEach(() => {
    prepararServicio();
    limpiarFlujo();
  });
  afterEach(() => setServiceParaTests(null));

  it('muestra nombre, duracion, "Desde", la nota del valor final y el contador de fotos', async () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Esmaltado semipermanente' })).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Desde $12.000')).toBeInTheDocument();
    expect(screen.getByText('El valor final depende del diseño y se confirma en el salón.')).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Ver foto \d/ })).toHaveLength(4);
  });

  it('no inventa descripcion cuando el servicio no la tiene', async () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Esmaltado semipermanente' });
    expect(document.querySelector('[data-descripcion]')).toBeNull();
  });

  it('tocar una miniatura cambia la foto grande (contador)', async () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver foto 3' }));
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver foto 3' })).toHaveAttribute('aria-current', 'true');
  });

  it('"Agregar a mi turno" agrega el servicio y vuelve a la lista', async () => {
    const ir = vi.fn();
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={ir} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar a mi turno' }));
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([1]);
    expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios');
  });

  it('si ya estaba elegido ofrece "Quitar de mi turno" y lo saca', async () => {
    const s = useReservaOnlineStore.getState();
    s.activarSlug('demo');
    s.setServicios([1, 3]);
    const ir = vi.fn();
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={ir} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar de mi turno' }));
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([3]);
    expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios');
  });

  it('el boton volver regresa a la lista sin cambiar la seleccion', async () => {
    const ir = vi.fn();
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={ir} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios');
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
  });

  it('un servicio inexistente informa que no se encontro', async () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={99} ir={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No encontramos este servicio.'));
  });
});
