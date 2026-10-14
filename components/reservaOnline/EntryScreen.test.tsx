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

  // El "Cargando…" de texto plano (Mensaje) se ve mal en la primera pantalla
  // que ve la clienta — acá pasa a un esqueleto que respeta la forma del
  // layout nuevo (portada + círculo + tarjetas), sin salto al llegar los datos.
  it('mientras carga, muestra un esqueleto en vez del texto plano "Cargando…"', () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(screen.getByTestId('entry-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('el esqueleto desaparece apenas los datos están listos', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(screen.getByTestId('entry-skeleton')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(screen.queryByTestId('entry-skeleton')).toBeNull();
  });

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

  // logoUrl casi siempre es una FOTO del local (cartel, ambiente), no un
  // ícono cuadrado — recortarla en el círculo chico la vuelve ilegible (ver
  // caso real: placa de Natalia Acosta). Pasa a portada (banda ancha, donde
  // una foto real luce bien) y el círculo siempre queda con la inicial.
  it('con avatarUrl, la profesional se ve con su foto real en "Te atienden"', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getSalon: async (s) => {
        const salon = await svc.getSalon(s);
        return {
          ...salon,
          profesionales: salon.profesionales.map((p) =>
            p.nombre === 'Ana' ? { ...p, avatarUrl: 'https://cdn.test/ana.jpg' } : p,
          ),
        };
      },
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(document.querySelector('img[src="https://cdn.test/ana.jpg"]')).not.toBeNull();
  });

  it('con logo_url, la foto va de portada (banda ancha), no en el círculo', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getSalon: async (s) => ({ ...(await svc.getSalon(s)), logoUrl: 'https://cdn.test/logo.png' }),
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(document.querySelector('img[src="https://cdn.test/logo.png"]')).not.toBeNull();
  });

  it('con o sin logo_url, el círculo siempre muestra la inicial (nunca la foto recortada)', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getSalon: async (s) => ({ ...(await svc.getSalon(s)), logoUrl: 'https://cdn.test/logo.png' }),
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('explica como funciona en 3 pasos', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    await screen.findByRole('heading', { name: 'Studio Demo' });
    expect(screen.getByText('Elegí servicios y horario')).toBeInTheDocument();
    expect(screen.getByText('Pagá una seña de $5.000,00')).toBeInTheDocument();
    expect(screen.getByText('Turno confirmado')).toBeInTheDocument();
  });

  // La duda de plata mas comun: cuanto es la seña. Antes recien aparecia en el paso 4.
  // La seña por porcentaje incluye el costo del pago online: el cliente deja un poco más que el
  // porcentaje. Para que las cuentas le cierren, nunca se le dice "del 30%".
  it('el paso de la seña dice el monto si es fijo, y no menciona ningún porcentaje si es por porcentaje', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getTerms: async (slug: string) => ({
        ...(await svc.getTerms(slug)),
        senaTipo: 'porcentaje' as const,
        deposito: null,
        senaPorcentaje: 30,
      }),
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Pagá una seña')).toBeInTheDocument();
    expect(screen.queryByText(/30%/)).toBeNull();
  });

  it('sin el dato de la seña, el paso queda como antes ("Pagá una seña"), sin inventar un monto', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getTerms: async (slug: string) => ({
        ...(await svc.getTerms(slug)),
        senaTipo: 'porcentaje' as const,
        deposito: null,
        senaPorcentaje: null,
      }),
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Pagá una seña')).toBeInTheDocument();
  });

  it('aclara que no hace falta crear una cuenta', async () => {
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('No necesitás crear una cuenta')).toBeInTheDocument();
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

  // Fase 1 de Mercado Pago: sin seña+MP conectados no tiene sentido dejar
  // completar todo el formulario para terminar en un error al pagar.
  it('con pagoHabilitado en false, bloquea a pantalla completa y no ofrece el CTA', async () => {
    const svc = prepararServicio();
    setServiceParaTests({
      ...svc,
      getSalon: async (s) => ({ ...(await svc.getSalon(s)), pagoHabilitado: false }),
    });
    renderWithProviders(<EntryScreen slug="demo" ir={() => {}} />);
    expect(await screen.findByText('Todavía no está disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reservar turno' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Studio Demo' })).toBeNull();
  });

  it('salon inexistente o sin add-on: pantalla amable y sin CTA', async () => {
    renderWithProviders(<EntryScreen slug="no-existe" ir={() => {}} />);
    await waitFor(() => expect(screen.getByText('Este negocio no recibe reservas online')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reservar turno' })).toBeNull();
  });
});
