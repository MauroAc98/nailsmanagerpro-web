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

  // El "Cargando…" de texto plano se ve mal aca: pasa a un esqueleto que
  // respeta la forma real (galeria + titulo/duracion + boton).
  it('mientras carga, muestra un esqueleto en vez del texto plano "Cargando…"', () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    expect(screen.getByTestId('detalle-servicio-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('el esqueleto desaparece apenas el servicio esta listo', async () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    expect(screen.getByTestId('detalle-servicio-skeleton')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Esmaltado semipermanente' });
    expect(screen.queryByTestId('detalle-servicio-skeleton')).toBeNull();
  });

  it('muestra nombre, duracion, "Desde", la nota del valor final y el contador de fotos', async () => {
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Esmaltado semipermanente' })).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Desde $12.000')).toBeInTheDocument();
    expect(screen.getByText('El valor final depende del diseño y se confirma en el negocio.')).toBeInTheDocument();
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

  it('tocar la foto grande abre el visor a pantalla completa en la foto actual', async () => {
    // El servicio demo usa fotos placeholder (baldosas de gradiente, sin
    // imagenes reales) — ver lib/reservaOnline/adapters/mock.ts.
    renderWithProviders(<DetalleServicioScreen slug="demo" servicioId={1} ir={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ver foto 3' }));
    expect(screen.getByText('3 / 4')).toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText('Ampliar foto 3'));
    const visor = screen.getByTestId('visor-fotos-area');
    expect(visor.querySelector('[data-placeholder]')).toHaveAttribute('data-placeholder', '2'); // fotos[2] = 'placeholder:2'
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    // La galeria paginada de abajo sigue intacta, sin reemplazarse por el visor.
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver foto 3' })).toHaveAttribute('aria-current', 'true');
  });
});
