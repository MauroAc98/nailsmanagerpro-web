import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { DatosScreen } from './DatosScreen';
import { flujoHasta, limpiarFlujo, prepararServicio } from './testUtils';

describe('DatosScreen', () => {
  beforeEach(() => {
    prepararServicio();
    limpiarFlujo();
    flujoHasta('datos');
  });
  afterEach(() => setServiceParaTests(null));

  it('sin horario elegido redirige a horario (guard)', async () => {
    limpiarFlujo();
    flujoHasta('horario');
    const ir = vi.fn();
    renderWithProviders(<DatosScreen slug="demo" ir={ir} />);
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/reservar/demo/horario'));
  });

  it('Continuar esta deshabilitado con los datos vacios', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('un WhatsApp sin codigo de pais bloquea Continuar y muestra el error', async () => {
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '1155');
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresá un WhatsApp válido');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('con datos validos guarda en el store (E.164 normalizado) y avanza al resumen', async () => {
    const ir = vi.fn();
    renderWithProviders(<DatosScreen slug="demo" ir={ir} />);
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Marta');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Ríos');
    await userEvent.type(screen.getByLabelText('WhatsApp'), '+54 9 376 512 3456');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(useReservaOnlineStore.getState().cliente).toEqual({
      nombre: 'Marta',
      apellido: 'Ríos',
      whatsapp: '+5493765123456',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/resumen');
  });

  it('restaura lo guardado al volver desde el resumen', async () => {
    useReservaOnlineStore.getState().setCliente({ nombre: 'Lu', apellido: 'Paz', whatsapp: '+5491155551234' });
    renderWithProviders(<DatosScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Lu');
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });
});
