import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { ServiciosScreen } from './ServiciosScreen';
import { limpiarFlujo, prepararServicio } from './testUtils';

describe('ServiciosScreen', () => {
  beforeEach(() => {
    prepararServicio();
    limpiarFlujo();
  });
  afterEach(() => setServiceParaTests(null));

  it('lista los servicios con duracion y precio "Desde" (referencia, nunca un precio firme)', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Esmaltado semipermanente')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Desde $12.000')).toBeInTheDocument();
    expect(screen.queryByText('$12.000')).toBeNull();
  });

  it('titulo con subtitulo y la nota de que los precios son de referencia', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: '¿Qué te querés hacer?' })).toBeInTheDocument();
    expect(screen.getByText('Podés elegir más de uno.')).toBeInTheDocument();
    expect(
      screen.getByText('Los precios son de referencia: el valor final depende del diseño y se confirma en el salón.'),
    ).toBeInTheDocument();
  });

  it('sin seleccion, Continuar esta deshabilitado', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    await screen.findByText('Kapping gel');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('multi-seleccion: cuenta servicios en el boton, NO muestra ningun total, y guarda en el store', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Retiro de esmalte/ }));
    expect(screen.getByRole('button', { name: 'Continuar · 2 servicios' })).toBeEnabled();
    // 12.000 + 8.000 no se suma: solo aparece el "Desde" de cada tarjeta.
    expect(screen.queryByText('$20.000')).toBeNull();
    expect(screen.getAllByText('Desde $20.000')).toHaveLength(1); // Kapping gel, su propio precio
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([1, 2]);
  });

  it('deseleccionar vuelve a deshabilitar Continuar', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    const esmaltado = await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ });
    await userEvent.click(esmaltado);
    await userEvent.click(esmaltado);
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('Continuar navega a horario; volver a la entrada', async () => {
    const ir = vi.fn();
    renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Retiro de esmalte/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/horario');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo');
  });

  it('restaura la seleccion guardada al montar', async () => {
    const s = useReservaOnlineStore.getState();
    s.activarSlug('demo');
    s.setServicios([3]);
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('checkbox', { name: /Kapping gel/ })).toBeChecked();
  });

  describe('fotos', () => {
    it('un servicio con fotos muestra miniatura y la pastilla "N fotos"', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      await screen.findByText('Esmaltado semipermanente');
      expect(screen.getByText('4 fotos')).toBeInTheDocument();
      expect(screen.getByText('6 fotos')).toBeInTheDocument();
    });

    it('un servicio sin fotos es la tarjeta de siempre, sin miniatura ni pastilla', async () => {
      renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
      const retiro = (await screen.findByText('Retiro de esmalte')).closest('button') as HTMLElement;
      expect(retiro).toHaveAttribute('role', 'checkbox');
      expect(within(retiro).queryByText(/foto/)).toBeNull();
    });

    it('tocar el cuerpo de la tarjeta abre el detalle y NO cambia la seleccion', async () => {
      const ir = vi.fn();
      renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
      await userEvent.click(await screen.findByRole('button', { name: /Ver fotos de Esmaltado semipermanente/ }));
      expect(ir).toHaveBeenCalledWith('/reservar/demo/servicio/1');
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([]);
    });

    it('el boton de agregar de una tarjeta con fotos selecciona sin navegar', async () => {
      const ir = vi.fn();
      renderWithProviders(<ServiciosScreen slug="demo" ir={ir} />);
      await userEvent.click(await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ }));
      expect(useReservaOnlineStore.getState().servicioIds).toEqual([1]);
      expect(ir).not.toHaveBeenCalled();
    });
  });
});
