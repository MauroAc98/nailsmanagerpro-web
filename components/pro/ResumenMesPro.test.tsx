import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import { proService } from '@/services/proService';
import { cacheResumen, vaciarCachesPro } from '@/lib/pro/caches';
import type { ProResumen, ProVinculo } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { ResumenMesPro } from './ResumenMesPro';

const vinculo: ProVinculo = {
  id: 1,
  negocioNombre: 'Negocio 1',
  profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
  disponible: true,
  motivo: null,
};

const resumen = (parcial: Partial<ProResumen> = {}): ProResumen => ({
  atendidos: 24,
  por_venir: 9,
  cancelados: 2,
  mas_pedido: 'Soft gel',
  ...parcial,
});

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo], vinculoActivoId: 1, bloqueos: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('ResumenMesPro', () => {
  it('muestra el título con el mes, los tres conteos con su rótulo y el más pedido', async () => {
    const pedir = vi.spyOn(proService, 'resumen').mockResolvedValue(resumen());
    renderWithProviders(<ResumenMesPro mes="2026-10" />);

    expect(await screen.findByText('Resumen de octubre')).toBeInTheDocument();
    expect(pedir).toHaveBeenCalledWith(1, '2026-10', expect.any(AbortSignal));
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('turnos atendidos')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('por venir')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('cancelados')).toBeInTheDocument();
    expect(screen.getByText(/Más pedido:/)).toHaveTextContent('Más pedido: Soft gel');
  });

  it('los rótulos van en singular con un solo turno', async () => {
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen({ atendidos: 1, cancelados: 1 }));
    renderWithProviders(<ResumenMesPro mes="2026-10" />);

    expect(await screen.findByText('turno atendido')).toBeInTheDocument();
    expect(screen.getByText('cancelado')).toBeInTheDocument();
  });

  it('el nombre del mes sigue al mes pedido y al idioma', async () => {
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen());
    renderWithProviders(<ResumenMesPro mes="2026-12" />);
    expect(await screen.findByText('Resumen de diciembre')).toBeInTheDocument();
  });

  it('mientras carga dibuja esqueletos marcados como ocupados y ningún número', () => {
    vi.spyOn(proService, 'resumen').mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ResumenMesPro mes="2026-10" />);

    const tarjeta = screen.getByTestId('resumen-mes-esqueleto');
    expect(tarjeta).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Resumen de octubre')).toBeInTheDocument();
    expect(screen.queryByText(/Más pedido/)).toBeNull();
    expect(tarjeta.textContent).not.toMatch(/\d/);
  });

  it('si el mes no tiene turnos no se dibuja nada', async () => {
    const pedir = vi.spyOn(proService, 'resumen').mockResolvedValue(resumen({ atendidos: 0, por_venir: 0, cancelados: 0, mas_pedido: null }));
    const { container } = renderWithProviders(<ResumenMesPro mes="2026-10" />);

    await waitFor(() => expect(pedir).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('si falla no se dibuja nada ni se muestra el error', async () => {
    const pedir = vi.spyOn(proService, 'resumen').mockRejectedValue(Object.assign(new Error('boom'), { proError: { kind: 'server' } }));
    const { container } = renderWithProviders(<ResumenMesPro mes="2026-10" />);

    await waitFor(() => expect(pedir).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin servicio más pedido omite esa línea y mantiene los conteos', async () => {
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen({ mas_pedido: null }));
    renderWithProviders(<ResumenMesPro mes="2026-10" />);

    expect(await screen.findByText('turnos atendidos')).toBeInTheDocument();
    expect(screen.queryByText(/Más pedido/)).toBeNull();
  });

  it('muestra al instante lo ya visto del mes y lo refresca de fondo', async () => {
    cacheResumen.set('1:resumen:2026-10', resumen({ atendidos: 5 }));
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen({ atendidos: 6 }));
    renderWithProviders(<ResumenMesPro mes="2026-10" />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(await screen.findByText('6')).toBeInTheDocument();
  });

  it('no es un botón ni un enlace: no navega a ninguna parte', async () => {
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen());
    renderWithProviders(<ResumenMesPro mes="2026-10" />);

    await screen.findByText('turnos atendidos');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('no muestra dinero', async () => {
    vi.spyOn(proService, 'resumen').mockResolvedValue(resumen());
    const { container } = renderWithProviders(<ResumenMesPro mes="2026-10" />);

    await screen.findByText('turnos atendidos');
    expect(container.textContent).not.toMatch(/[$€]|cobrad|clientes? nuev/i);
  });
});
