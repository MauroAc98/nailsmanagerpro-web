import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';
import { proService } from '@/services/proService';
import { vaciarCachesPro } from '@/lib/pro/caches';
import type { ProListaTurnos, ProTurno, ProVinculo } from '@/lib/pro/tipos';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/agenda', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

import { AgendaPro } from './AgendaPro';

const vinculo: ProVinculo = {
  id: 1,
  negocioNombre: 'Negocio 1',
  profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
  disponible: true,
  motivo: null,
};

function turno(id: number, fecha_hora: string): ProTurno {
  return {
    id,
    fecha_hora,
    duracion_total_minutos: 60,
    estado_visual: 'confirmado',
    notas: null,
    cliente: { nombre: `Cliente${id}`, apellido: null },
    servicios: [{ id: 1, nombre: 'Esmaltado' }],
    promo: null,
  };
}

const lista = (turnos: ProTurno[]): ProListaTurnos => ({ turnos, truncated: false, descartados: 0 });

beforeEach(() => {
  nav.pathname = '/agenda';
  nav.push.mockReset();
  vaciarCachesPro();
  useProAuthStore.setState({ status: 'full', token: 't', vinculos: [vinculo], vinculoActivoId: 1, bloqueos: {} });
  useProAgendaStore.getState().reset();
  useProAgendaStore.getState().setFecha('2026-10-17');
  vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [], descartados: 0 });
});
afterEach(() => vi.restoreAllMocks());

describe('AgendaPro', () => {
  it('arma la pantalla: encabezado, título enfocado, tira semanal, lista y navegación', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    renderWithProviders(<AgendaPro />);

    const titulo = screen.getByRole('heading', { level: 1, name: 'Agenda' });
    expect(titulo).toHaveFocus();
    expect(screen.getByText('Negocio 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByTestId('week-day-2026-10-12')).toBeInTheDocument();
    expect(screen.getByTestId('week-day-2026-10-18')).toBeInTheDocument();
    expect(await screen.findByText('Cliente1')).toBeInTheDocument();
  });

  it('mientras carga muestra el spinner y al llegar vacío muestra el estado vacío', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    expect(screen.getByRole('status', { name: 'Cargando turnos' })).toBeInTheDocument();
    expect(await screen.findByText('No hay turnos para este día.')).toBeInTheDocument();
  });

  it('lista los turnos en orden cronológico', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(
      lista([turno(2, '2026-10-17T15:00:00'), turno(1, '2026-10-17T08:00:00')]),
    );
    renderWithProviders(<AgendaPro />);
    await screen.findByText('Cliente1');
    const filas = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(filas[0]).toContain('Cliente1');
    expect(filas[1]).toContain('Cliente2');
  });

  it('elegir un día de la tira fija la fecha del store y pide ese día una sola vez', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    expect(turnos).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('week-day-2026-10-14'));

    expect(useProAgendaStore.getState().fecha).toBe('2026-10-14');
    await waitFor(() => expect(turnos).toHaveBeenCalledTimes(2));
    expect(turnos).toHaveBeenLastCalledWith(1, { fecha: '2026-10-14' }, expect.any(AbortSignal));
    await screen.findByText('No hay turnos para este día.');
    expect(turnos).toHaveBeenCalledTimes(2);
  });

  it('las flechas cambian de semana sin pedir turnos ni cambiar la fecha elegida', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');

    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    expect(screen.getByTestId('week-day-2026-10-19')).toBeInTheDocument();
    expect(screen.queryByTestId('week-day-2026-10-12')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));
    expect(screen.getByTestId('week-day-2026-10-05')).toBeInTheDocument();

    expect(useProAgendaStore.getState().fecha).toBe('2026-10-17');
    expect(turnos).toHaveBeenCalledTimes(1);
  });

  it('pide las marcas del mes de la semana que se ve', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    const marcas = vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [], descartados: 0 });
    renderWithProviders(<AgendaPro />);
    await waitFor(() => expect(marcas).toHaveBeenCalledWith(1, '2026-10', expect.any(AbortSignal)));
    expect(marcas).toHaveBeenCalledTimes(1);
  });

  it('un error muestra el copy del tipo y reintentar vuelve a pedir el día', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockRejectedValueOnce(new Error('boom')).mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).not.toHaveTextContent('boom');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay turnos para este día.')).toBeInTheDocument();
    expect(turnos).toHaveBeenCalledTimes(2);
  });

  it('tocar una tarjeta navega al detalle del turno, con prefijo /pro en localhost', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(7, '2026-10-17T09:00:00')]));
    const { unmount } = renderWithProviders(<AgendaPro />);
    fireEvent.click(await screen.findByRole('button', { name: /Cliente7/ }));
    expect(nav.push).toHaveBeenCalledWith('/turnos/7');
    unmount();

    nav.pathname = '/pro/agenda';
    renderWithProviders(<AgendaPro />);
    fireEvent.click(await screen.findByRole('button', { name: /Cliente7/ }));
    expect(nav.push).toHaveBeenLastCalledWith('/pro/turnos/7');
  });

  it('en la vista mensual no muestra la tira ni la lista del día', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    useProAgendaStore.getState().setVista('mes');
    renderWithProviders(<AgendaPro />);
    expect(screen.queryByTestId('week-day-2026-10-17')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('el calendario de la tira lleva a la vista mensual', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendario completo' }));
    expect(useProAgendaStore.getState().vista).toBe('mes');
  });

  it('una fecha elegida fuera de la semana mostrada mueve la tira a esa semana', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    useProAgendaStore.getState().setFecha('2026-11-04');
    await waitFor(() => expect(screen.getByTestId('week-day-2026-11-04')).toBeInTheDocument());
  });
});
