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

  it('muestra nombre serif y direccion con "Cómo llegar" a Google Maps', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByRole('heading', { name: 'Studio Demo' })).toBeInTheDocument();
    expect(screen.getByText('Av. Siempreviva 742')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Cómo llegar' });
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    expect(link).toHaveAttribute('href', expect.stringContaining('Siempreviva'));
  });

  it('sin logo, el avatar es la inicial del salon', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('con logo_url, el avatar es la imagen del salon', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getSalon: async (s) => ({ ...(await svc.getSalon(s)), logoUrl: 'https://cdn.test/logo.png' }),
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(document.querySelector('img[src="https://cdn.test/logo.png"]')).not.toBeNull();
  });

  it('explica como funciona en 3 pasos', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(screen.getByText('Elegí servicios y horario')).toBeInTheDocument();
    expect(screen.getByText('Pagá una seña')).toBeInTheDocument();
    expect(screen.getByText('Turno confirmado')).toBeInTheDocument();
  });

  it('"Te atienden" lista a las profesionales con iniciales', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    const linea = await screen.findByText(/Te atienden/);
    expect(linea).toHaveTextContent('Te atienden Ana y Lucía');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('muestra la cancelacion gratis con la ventana configurada (24 h por defecto)', async () => {
    const svc = prepararServicio();
    await svc.saveSettings({ ventanaCancelacionHoras: 48 });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Cancelación gratis hasta 48 h antes')).toBeInTheDocument();
  });

  it('"Reservar turno" navega a servicios y el pie aclara el pago seguro', async () => {
    const ir = vi.fn();
    renderWithProviders(<EntryScreen slug="demo" ir={ir} />);
    expect(await screen.findByText('Pago seguro con Mercado Pago')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reservar turno' }));
    expect(ir).toHaveBeenCalledWith('/reservar/demo/servicios');
  });

  it('salon inexistente: mensaje de no encontrado y sin CTA', async () => {
    renderWithProviders(<EntryScreen slug="no-existe" ir={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No encontramos este salón.'));
    expect(screen.queryByRole('button', { name: 'Reservar turno' })).toBeNull();
  });
});
