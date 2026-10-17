import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { proService } from '@/services/proService';
import { vaciarCachesPro } from '@/lib/pro/caches';
import type { ProMarcas, ProVinculo } from '@/lib/pro/tipos';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';
import { VistaMes } from './VistaMes';

const vinculo = (id: number): ProVinculo => ({
  id,
  negocioNombre: `Negocio ${id}`,
  profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
  disponible: true,
  motivo: null,
});

const marcas = (dias: { fecha: string; cantidad: number }[], descartados = 0): ProMarcas => ({ dias, descartados });

beforeEach(() => {
  vaciarCachesPro();
  useProAuthStore.setState({
    status: 'full',
    token: 't',
    vinculos: [vinculo(1), vinculo(2)],
    vinculoActivoId: 1,
    bloqueos: {},
  });
  useProAgendaStore.getState().reset();
  useProAgendaStore.getState().setFecha('2026-10-17');
  useProAgendaStore.getState().setVista('mes');
});
afterEach(() => vi.restoreAllMocks());

describe('VistaMes', () => {
  it('muestra el mes con su nombre y la grilla de días, y pide las marcas de ese mes', async () => {
    const spy = vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([]));
    renderWithProviders(<VistaMes />);
    expect(screen.getByText('octubre de 2026')).toBeInTheDocument();
    expect(screen.getByTestId('mes-dia-2026-10-01')).toBeInTheDocument();
    expect(screen.getByTestId('mes-dia-2026-10-31')).toBeInTheDocument();
    expect(screen.queryByTestId('mes-dia-2026-10-32')).toBeNull();
    await waitFor(() => expect(spy).toHaveBeenCalledWith(1, '2026-10', expect.any(AbortSignal)));
  });

  it('marca solo los días con cantidad mayor que cero, con la cantidad como único dato', async () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(
      marcas([
        { fecha: '2026-10-14', cantidad: 3 },
        { fecha: '2026-10-15', cantidad: 0 },
      ]),
    );
    renderWithProviders(<VistaMes />);
    const marcado = await screen.findByRole('button', { name: /14 de octubre.*3 turnos/ });
    expect(marcado).toHaveAttribute('data-con-turnos', 'true');
    expect(marcado).toHaveTextContent('3');
    const vacio = screen.getByTestId('mes-dia-2026-10-15');
    expect(vacio).not.toHaveAttribute('data-con-turnos', 'true');
    expect(vacio).toHaveTextContent(/^15$/);
    expect(screen.getByTestId('mes-dia-2026-10-16')).toHaveTextContent(/^16$/);
  });

  it('no muestra dinero ni resumen del mes', async () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([{ fecha: '2026-10-14', cantidad: 2 }]));
    const { container } = renderWithProviders(<VistaMes />);
    await screen.findByRole('button', { name: /14 de octubre/ });
    expect(container.textContent).not.toMatch(/\$|ARS|R\$|ingres|total|gast/i);
  });

  it('tocar un día marcado fija la fecha y vuelve a la vista de día', async () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([{ fecha: '2026-10-14', cantidad: 3 }]));
    renderWithProviders(<VistaMes />);
    fireEvent.click(await screen.findByRole('button', { name: /14 de octubre.*3 turnos/ }));
    expect(useProAgendaStore.getState().fecha).toBe('2026-10-14');
    expect(useProAgendaStore.getState().vista).toBe('dia');
  });

  it('un día sin turnos también se puede abrir y se anuncia como sin turnos', async () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([]));
    renderWithProviders(<VistaMes />);
    fireEvent.click(await screen.findByRole('button', { name: /20 de octubre.*sin turnos/ }));
    expect(useProAgendaStore.getState().fecha).toBe('2026-10-20');
    expect(useProAgendaStore.getState().vista).toBe('dia');
  });

  it('navegar de mes pide el mes nuevo una vez y volver a uno ya visto lo muestra al instante desde la caché', async () => {
    const spy = vi
      .spyOn(proService, 'marcas')
      .mockImplementation(async (_id, m) => marcas(m === '2026-10' ? [{ fecha: '2026-10-14', cantidad: 3 }] : []));
    renderWithProviders(<VistaMes />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('noviembre de 2026')).toBeInTheDocument();
    expect(useProAgendaStore.getState().mesVisto).toBe('2026-11');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenLastCalledWith(1, '2026-11', expect.any(AbortSignal));

    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText('octubre de 2026')).toBeInTheDocument();
    // octubre sale de la caché en el mismo render (se revalida en segundo plano,
    // sin spinner que tape las marcas)
    expect(screen.getByRole('button', { name: /14 de octubre.*3 turnos/ })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Cargando turnos' })).toBeNull();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('cruza el año al navegar', () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([]));
    useProAgendaStore.getState().setMesVisto('2026-12');
    renderWithProviders(<VistaMes />);
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('enero de 2027')).toBeInTheDocument();
  });

  it('no deja ir antes de 2000-01', () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([]));
    useProAgendaStore.getState().setMesVisto('2000-01');
    renderWithProviders(<VistaMes />);
    const anterior = screen.getByRole('button', { name: 'Mes anterior' });
    expect(anterior).toBeDisabled();
    fireEvent.click(anterior);
    expect(useProAgendaStore.getState().mesVisto).toBe('2000-01');
  });

  it('si fallan las marcas el calendario sigue usable y se puede reintentar', async () => {
    const spy = vi
      .spyOn(proService, 'marcas')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(marcas([{ fecha: '2026-10-14', cantidad: 2 }]));
    renderWithProviders(<VistaMes />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).not.toHaveTextContent('boom');
    expect(screen.getByTestId('mes-dia-2026-10-10')).toBeInTheDocument();
    expect(useProAuthStore.getState().status).toBe('full');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /14 de octubre.*2 turnos/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('con descartados la vista no se rompe', async () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([{ fecha: '2026-10-14', cantidad: 1 }], 4));
    renderWithProviders(<VistaMes />);
    expect(await screen.findByRole('button', { name: /14 de octubre.*1 turno/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mientras carga por primera vez muestra el spinner sin tapar la grilla', async () => {
    vi.spyOn(proService, 'marcas').mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<VistaMes />);
    expect(screen.getByRole('status', { name: 'Cargando turnos' })).toBeInTheDocument();
    expect(screen.getByTestId('mes-dia-2026-10-10')).toBeInTheDocument();
  });

  it('cambiar de negocio reinicia el mes visto y descarta las marcas del otro negocio', async () => {
    const spy = vi.spyOn(proService, 'marcas').mockImplementation(async (id) =>
      id === 1 ? marcas([{ fecha: '2026-10-14', cantidad: 3 }]) : marcas([]),
    );
    renderWithProviders(<VistaMes />);
    await screen.findByRole('button', { name: /14 de octubre.*3 turnos/ });
    fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(useProAgendaStore.getState().mesVisto).toBe('2026-11');

    useProAuthStore.getState().elegirVinculo(2);

    await waitFor(() => expect(spy).toHaveBeenCalledWith(2, expect.stringMatching(/^\d{4}-\d{2}$/), expect.any(AbortSignal)));
    expect(useProAgendaStore.getState().mesVisto).not.toBe('2026-11');
    expect(screen.queryByRole('button', { name: /3 turnos/ })).toBeNull();
  });

  it('accesibilidad: navegación con nombre y objetivos táctiles de al menos 44px', async () => {
    vi.spyOn(proService, 'marcas').mockResolvedValue(marcas([{ fecha: '2026-10-14', cantidad: 3 }]));
    renderWithProviders(<VistaMes />);
    const anterior = screen.getByRole('button', { name: 'Mes anterior' });
    const siguiente = screen.getByRole('button', { name: 'Mes siguiente' });
    for (const boton of [anterior, siguiente, screen.getByTestId('mes-dia-2026-10-14')]) {
      expect(parseInt(boton.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(boton.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
    expect(screen.getByRole('group', { name: 'octubre de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'octubre de 2026' })).toBeInTheDocument();
  });
});
