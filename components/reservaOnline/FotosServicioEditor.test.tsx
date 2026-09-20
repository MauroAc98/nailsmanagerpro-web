import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import api from '@/lib/api';
import { FotosServicioEditor } from './FotosServicioEditor';

// Editor de fotos del portafolio de un servicio — pantalla autenticada de
// Configuracion (no del flujo publico de reserva), rewireada de la vieja
// implementacion mock (localStorage, array de strings) a los endpoints
// reales via servicioService (`@/lib/api`, limite de red mockeado, mismo
// criterio que profesionalService.test.ts/servicioService.test.ts).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

const mockedGet = vi.mocked(api.get);
const mockedPost = vi.mocked(api.post);
const mockedDelete = vi.mocked(api.delete);
const mockedPatch = vi.mocked(api.patch);

const ID = 5;
const foto = (id: number, url = `https://cdn.test/${id}.jpg`) => ({ id, url, orden: id });

function mockServicio(fotos: ReturnType<typeof foto>[]) {
  mockedGet.mockResolvedValue({ data: { id: ID, fotos } });
}

describe('FotosServicioEditor', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedDelete.mockReset();
    mockedPatch.mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  const montar = () => renderWithProviders(<FotosServicioEditor servicioId={ID} />);

  it('sin fotos muestra la ayuda y solo el mosaico "Agregar"', async () => {
    mockServicio([]);
    montar();
    expect(await screen.findByText('Fotos de tus trabajos')).toBeInTheDocument();
    expect(
      screen.getByText('Las clientas las ven al elegir este servicio. La primera es la portada.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar fotos')).toBeInTheDocument();
    expect(screen.queryByText('Portada')).toBeNull();
  });

  it('la primera foto lleva la insignia "Portada" y solo ella', async () => {
    mockServicio([foto(1), foto(2), foto(3)]);
    montar();
    expect(await screen.findAllByText('Portada')).toHaveLength(1);
    expect(screen.getByText('Portada').closest('[data-foto="0"]')).not.toBeNull();
  });

  it('mover a la derecha reordena y persiste; la que sube a primera pasa a ser portada', async () => {
    mockServicio([foto(1), foto(2)]);
    mockedPatch.mockResolvedValue({ data: { id: ID, fotos: [foto(2), foto(1)] } });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Mover foto 1 a la derecha' }));
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/servicios/5/fotos/reordenar', { ids: [2, 1] }));
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    expect(screen.getByText('Portada').closest('[data-src="https://cdn.test/2.jpg"]')).not.toBeNull();
  });

  it('mover a la izquierda reordena y persiste', async () => {
    mockServicio([foto(1), foto(2), foto(3)]);
    mockedPatch.mockResolvedValue({ data: { id: ID, fotos: [foto(1), foto(3), foto(2)] } });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Mover foto 3 a la izquierda' }));
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/servicios/5/fotos/reordenar', { ids: [1, 3, 2] }));
  });

  it('en los extremos los botones de mover estan deshabilitados', async () => {
    mockServicio([foto(1), foto(2)]);
    montar();
    expect(await screen.findByRole('button', { name: 'Mover foto 1 a la izquierda' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover foto 2 a la derecha' })).toBeDisabled();
  });

  it('quitar una foto la borra, persiste y la siguiente pasa a portada', async () => {
    mockServicio([foto(1), foto(2)]);
    mockedDelete.mockResolvedValue({ data: { id: ID, fotos: [foto(2)] } });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar foto 1' }));
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/servicios/5/fotos/1'));
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    expect(screen.getByText('Portada').closest('[data-src="https://cdn.test/2.jpg"]')).not.toBeNull();
  });

  it('agregar una imagen la suma al final y persiste contra el backend real', async () => {
    mockServicio([]);
    mockedPost.mockResolvedValue({ data: { id: ID, fotos: [foto(1, 'https://cdn.test/subida.jpg')] } });
    montar();
    const archivo = new File(['x'.repeat(2000)], 'trabajo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), archivo);
    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/servicios/5/fotos', expect.any(FormData), expect.anything()));
    const form = mockedPost.mock.calls.at(-1)?.[1] as FormData;
    expect(form.get('imagen')).toBe(archivo);
    expect(await screen.findByText('Portada')).toBeInTheDocument();
    expect(document.querySelector('img[src="https://cdn.test/subida.jpg"]')).not.toBeNull();
  });

  it('una foto que supera el tope de tamano (5MB) se rechaza con un mensaje y no se sube', async () => {
    mockServicio([]);
    montar();
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'enorme.jpg', { type: 'image/jpeg' });
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), grande);
    expect(await screen.findByRole('alert')).toHaveTextContent('La foto es demasiado grande');
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('con 12 fotos ya no se puede agregar y avisa el maximo', async () => {
    mockServicio(Array.from({ length: 12 }, (_, i) => foto(i + 1)));
    montar();
    expect(await screen.findByText('Llegaste al máximo de 12 fotos.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agregar fotos')).toBeNull();
  });

  it('agregar varias a la vez respeta el maximo de 12 (sube solo hasta llegar al tope)', async () => {
    mockServicio(Array.from({ length: 11 }, (_, i) => foto(i + 1)));
    mockedPost.mockResolvedValue({ data: { id: ID, fotos: Array.from({ length: 12 }, (_, i) => foto(i + 1)) } });
    montar();
    const dos = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), dos);
    await waitFor(() => expect(mockedPost).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Llegaste al máximo de 12 fotos.')).toBeInTheDocument();
  });

  it('si falla la subida, avisa el error generico', async () => {
    mockServicio([]);
    mockedPost.mockRejectedValue(new Error('red'));
    montar();
    const archivo = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), archivo);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar la operación');
  });

  it('tocar la foto de una tile abre el visor en esa foto; cerrar vuelve al editor', async () => {
    mockServicio([foto(1), foto(2), foto(3)]);
    montar();
    await userEvent.click(await screen.findByLabelText('Ver foto 2 en pantalla completa'));
    const visor = screen.getByTestId('visor-fotos-area');
    expect(visor.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/2.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });

  it('abrir el visor no interfiere con los botones de mover/quitar de la tile', async () => {
    mockServicio([foto(1), foto(2)]);
    mockedDelete.mockResolvedValue({ data: { id: ID, fotos: [foto(2)] } });
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar foto 1' }));
    // Si el tap hubiera burbujeado tambien al handler de "abrir visor", el
    // visor (con su boton "Cerrar") quedaria abierto encima del editor.
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('/servicios/5/fotos/1'));
  });
});
