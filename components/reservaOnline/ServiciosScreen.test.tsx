import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
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

  it('lista los servicios con duracion y precio', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Esmaltado semipermanente')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('$12.000')).toBeInTheDocument();
  });

  it('sin seleccion, Continuar esta deshabilitado', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    await screen.findByText('Kapping gel');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('multi-seleccion: suma total y duracion corriente y guarda en el store', async () => {
    renderWithProviders(<ServiciosScreen slug="demo" ir={() => {}} />);
    await userEvent.click(await screen.findByRole('checkbox', { name: /Esmaltado semipermanente/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Retiro de esmalte/ }));
    expect(screen.getByText('2 servicios · 75 min')).toBeInTheDocument();
    expect(screen.getAllByText('$20.000')).toHaveLength(2); // el total y el precio de Kapping gel
    expect(useReservaOnlineStore.getState().servicioIds).toEqual([1, 2]);
  });

  it('deseleccionar resta del total', async () => {
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
    await userEvent.click(await screen.findByRole('checkbox', { name: /Kapping gel/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
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
});
