import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { setServiceParaTests } from '@/lib/reservaOnline';
import { EntradaFotosServicio } from './EntradaFotosServicio';
import { prepararServicio } from './testUtils';

describe('EntradaFotosServicio', () => {
  beforeEach(() => {
    prepararServicio();
  });
  afterEach(() => {
    setServiceParaTests(null);
    vi.unstubAllEnvs();
  });

  it('con la flag apagada no renderiza nada (la fila esta oculta)', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'false');
    const { container } = renderWithProviders(<EntradaFotosServicio servicioId={5} onAbrir={() => {}} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it('con la flag prendida muestra la fila y abre el gestor de fotos', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    const onAbrir = vi.fn();
    renderWithProviders(<EntradaFotosServicio servicioId={5} onAbrir={onAbrir} />);
    await userEvent.click(await screen.findByRole('button', { name: /Fotos de tus trabajos/ }));
    expect(onAbrir).toHaveBeenCalled();
  });

  it('muestra cuantas fotos tiene el servicio', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    const { getService } = await import('@/lib/reservaOnline');
    await getService().saveFotosServicio(5, ['placeholder:0', 'placeholder:1']);
    renderWithProviders(<EntradaFotosServicio servicioId={5} onAbrir={() => {}} />);
    expect(await screen.findByText('2 fotos')).toBeInTheDocument();
  });

  it('sin fotos lo dice', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    renderWithProviders(<EntradaFotosServicio servicioId={5} onAbrir={() => {}} />);
    expect(await screen.findByText('Sin fotos todavía')).toBeInTheDocument();
  });
});
