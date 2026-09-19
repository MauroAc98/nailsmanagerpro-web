import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import type { MockReservaOnlineService } from '@/lib/reservaOnline/adapters/mock';
import { TOPE_BYTES_FOTO } from '@/lib/reservaOnline/fotos';
import { FotosServicioEditor } from './FotosServicioEditor';
import { prepararServicio } from './testUtils';

const ID = 5;

describe('FotosServicioEditor', () => {
  let svc: MockReservaOnlineService;
  beforeEach(() => {
    svc = prepararServicio();
  });
  afterEach(() => setServiceParaTests(null));

  const montar = () => renderWithProviders(<FotosServicioEditor servicioId={ID} />);
  const guardadas = () => svc.getFotosServicio(ID);

  it('sin fotos muestra la ayuda y solo el mosaico "Agregar"', async () => {
    montar();
    expect(await screen.findByText('Fotos de tus trabajos')).toBeInTheDocument();
    expect(
      screen.getByText('Las clientas las ven al elegir este servicio. La primera es la portada.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar fotos')).toBeInTheDocument();
    expect(screen.queryByText('Portada')).toBeNull();
  });

  it('la primera foto lleva la insignia "Portada" y solo ella', async () => {
    await svc.saveFotosServicio(ID, ['placeholder:0', 'placeholder:1', 'placeholder:2']);
    montar();
    expect(await screen.findAllByText('Portada')).toHaveLength(1);
    expect(screen.getByText('Portada').closest('[data-foto="0"]')).not.toBeNull();
  });

  it('mover a la derecha reordena y persiste; la que sube a primera pasa a ser portada', async () => {
    await svc.saveFotosServicio(ID, ['placeholder:0', 'placeholder:1']);
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Mover foto 1 a la derecha' }));
    await waitFor(async () => expect(await guardadas()).toEqual(['placeholder:1', 'placeholder:0']));
    expect(screen.getByText('Portada').closest('[data-src="placeholder:1"]')).not.toBeNull();
  });

  it('mover a la izquierda reordena y persiste', async () => {
    await svc.saveFotosServicio(ID, ['placeholder:0', 'placeholder:1', 'placeholder:2']);
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Mover foto 3 a la izquierda' }));
    await waitFor(async () =>
      expect(await guardadas()).toEqual(['placeholder:0', 'placeholder:2', 'placeholder:1']),
    );
  });

  it('en los extremos los botones de mover estan deshabilitados', async () => {
    await svc.saveFotosServicio(ID, ['placeholder:0', 'placeholder:1']);
    montar();
    expect(await screen.findByRole('button', { name: 'Mover foto 1 a la izquierda' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover foto 2 a la derecha' })).toBeDisabled();
  });

  it('quitar una foto la borra, persiste y la siguiente pasa a portada', async () => {
    await svc.saveFotosServicio(ID, ['placeholder:0', 'placeholder:1']);
    montar();
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar foto 1' }));
    await waitFor(async () => expect(await guardadas()).toEqual(['placeholder:1']));
    expect(screen.getByText('Portada').closest('[data-src="placeholder:1"]')).not.toBeNull();
  });

  it('agregar una imagen la suma al final y persiste', async () => {
    montar();
    const archivo = new File(['x'.repeat(2000)], 'trabajo.jpg', { type: 'image/jpeg' });
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), archivo);
    await waitFor(async () => expect(await guardadas()).toHaveLength(1));
    expect((await guardadas())[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(await screen.findByText('Portada')).toBeInTheDocument();
  });

  it('una foto que supera el tope de tamano se rechaza con un mensaje y no se guarda', async () => {
    montar();
    const grande = new File([new Uint8Array(TOPE_BYTES_FOTO + 1024)], 'enorme.jpg', { type: 'image/jpeg' });
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), grande);
    expect(await screen.findByRole('alert')).toHaveTextContent('La foto es demasiado grande');
    expect(await guardadas()).toEqual([]);
  });

  it('con 12 fotos ya no se puede agregar y avisa el maximo', async () => {
    await svc.saveFotosServicio(
      ID,
      Array.from({ length: 12 }, (_, i) => `placeholder:${i}`),
    );
    montar();
    expect(await screen.findByText('Llegaste al máximo de 12 fotos.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agregar fotos')).toBeNull();
  });

  it('agregar varias a la vez respeta el maximo de 12 (se descartan las que sobran)', async () => {
    await svc.saveFotosServicio(
      ID,
      Array.from({ length: 11 }, (_, i) => `placeholder:${i}`),
    );
    montar();
    const dos = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    await userEvent.upload(await screen.findByLabelText('Agregar fotos'), dos);
    await waitFor(async () => expect(await guardadas()).toHaveLength(12));
  });
});
