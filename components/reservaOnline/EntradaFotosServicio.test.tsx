import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import userEvent from '@testing-library/user-event';
import api from '@/lib/api';
import { EntradaFotosServicio } from './EntradaFotosServicio';

// La fila lee las fotos via servicioService.getOne (autenticado — este es un
// componente de Configuracion, no del flujo publico de reserva), asi que se
// mockea `@/lib/api` (limite de red), no el servicio de reserva online.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
}));
const mockedGet = vi.mocked(api.get);

describe('EntradaFotosServicio', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: { id: 5, fotos: [] } });
  });
  afterEach(() => {
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
    mockedGet.mockResolvedValue({
      data: { id: 5, fotos: [{ id: 1, url: 'https://cdn.test/a.jpg', orden: 0 }, { id: 2, url: 'https://cdn.test/b.jpg', orden: 1 }] },
    });
    renderWithProviders(<EntradaFotosServicio servicioId={5} onAbrir={() => {}} />);
    expect(await screen.findByText('2 fotos')).toBeInTheDocument();
  });

  it('sin fotos lo dice', async () => {
    vi.stubEnv('NEXT_PUBLIC_RESERVA_ONLINE', 'true');
    renderWithProviders(<EntradaFotosServicio servicioId={5} onAbrir={() => {}} />);
    expect(await screen.findByText('Sin fotos todavía')).toBeInTheDocument();
  });
});
