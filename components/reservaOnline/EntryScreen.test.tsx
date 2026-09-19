import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { EntryScreen } from './EntryScreen';
import { limpiarFlujo, prepararServicio } from './testUtils';

describe('EntryScreen', () => {
  beforeEach(() => {
    prepararServicio();
    limpiarFlujo();
  });
  afterEach(() => setServiceParaTests(null));

  it('muestra nombre y direccion del salon y los 3 pasos', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Studio Demo' })).toBeInTheDocument();
    expect(screen.getByText('Av. Siempreviva 742')).toBeInTheDocument();
    expect(screen.getByText('Pagá una seña para asegurar tu lugar')).toBeInTheDocument();
  });

  it('"Reservar turno" navega al paso de servicios', async () => {
    const ir = vi.fn();
    renderWithProviders(<EntryScreen slug="demo" ir={ir} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reservar turno' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios');
  });

  it('salon inexistente: mensaje de no encontrado y sin CTA', async () => {
    renderWithProviders(<EntryScreen slug="no-existe" ir={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No encontramos este salón.'));
    expect(screen.queryByRole('button', { name: 'Reservar turno' })).toBeNull();
  });
});
