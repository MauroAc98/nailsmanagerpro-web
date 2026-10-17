import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '@/test/render';
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
    expect(screen.getByRole('group', { name: 'octubre de 2026' })).toBeInTheDocument();
  });

  it('tocar un día del mes vuelve a la vista de día con esa fecha, sin navegar', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [{ fecha: '2026-10-14', cantidad: 2 }], descartados: 0 });
    useProAgendaStore.getState().setVista('mes');
    renderWithProviders(<AgendaPro />);

    fireEvent.click(await screen.findByRole('button', { name: /14 de octubre.*2 turnos/ }));

    expect(screen.getByTestId('week-day-2026-10-14')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'octubre de 2026' })).toBeNull();
    expect(useProAgendaStore.getState().fecha).toBe('2026-10-14');
    expect(nav.push).not.toHaveBeenCalled();
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

describe('AgendaPro con filtros', () => {
  const servicios = { servicios: [{ id: 3, nombre: 'Esmaltado' }], descartados: 0 };

  async function aplicar(cambios: (dialogo: HTMLElement) => void) {
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Filtrar turnos' });
    cambios(dialogo);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar' }));
  }
  const escribir = (d: HTMLElement, texto: string) =>
    fireEvent.change(within(d).getByLabelText('Buscar por nombre...'), { target: { value: texto } });

  beforeEach(() => {
    vi.spyOn(proService, 'servicios').mockResolvedValue(servicios);
  });

  it('el botón Filtros abre la hoja y al cerrarla el foco vuelve al botón', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    const boton = screen.getByRole('button', { name: 'Filtros' });
    fireEvent.click(boton);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boton).toHaveFocus();
  });

  it('escribir en la hoja no pide nada; aplicar pide el rango de un día con el texto', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('Cliente1');
    turnos.mockClear();

    await aplicar((d) => {
      escribir(d, ' Ana ');
      expect(turnos).not.toHaveBeenCalled();
    });

    await waitFor(() => expect(turnos).toHaveBeenCalledTimes(1));
    expect(turnos).toHaveBeenCalledWith(1, { desde: '2026-10-17', hasta: '2026-10-17', buscar: 'Ana' }, expect.any(AbortSignal));
    expect(screen.queryByTestId('week-day-2026-10-17')).toBeNull();
  });

  it('indica los filtros activos con texto y no solo con color', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    renderWithProviders(<AgendaPro />);
    await aplicar((d) => {
      escribir(d, 'Ana');
      fireEvent.change(within(d).getByLabelText('Desde'), { target: { value: '2026-10-01' } });
      fireEvent.change(within(d).getByLabelText('Hasta'), { target: { value: '2026-10-05' } });
    });

    expect(await screen.findByRole('button', { name: 'Filtros: 2 activos' })).toBeInTheDocument();
    const activos = screen.getByRole('list', { name: 'Filtros activos' });
    expect(activos).toHaveTextContent('Nombre: Ana');
    expect(activos).toHaveTextContent('2026-10-01 a 2026-10-05');
  });

  it('agrupa por fecha los resultados del rango y envía desde/hasta sin fecha', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    turnos.mockResolvedValue(lista([turno(2, '2026-10-02T10:00:00'), turno(1, '2026-10-01T09:00:00')]));

    await aplicar((d) => {
      fireEvent.change(within(d).getByLabelText('Desde'), { target: { value: '2026-10-01' } });
      fireEvent.change(within(d).getByLabelText('Hasta'), { target: { value: '2026-10-05' } });
    });

    await screen.findByText('Cliente2');
    expect(turnos).toHaveBeenLastCalledWith(1, { desde: '2026-10-01', hasta: '2026-10-05' }, expect.any(AbortSignal));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      expect.stringMatching(/1 de octubre/),
      expect.stringMatching(/2 de octubre/),
    ]);
  });

  it('elegir un servicio envía servicio_id y lo nombra en los filtros activos', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Filtrar turnos' });
    fireEvent.change(await within(dialogo).findByLabelText('Servicio'), { target: { value: '3' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(turnos).toHaveBeenLastCalledWith(1, { desde: '2026-10-17', hasta: '2026-10-17', servicio_id: 3 }, expect.any(AbortSignal)),
    );
    expect(await screen.findByRole('list', { name: 'Filtros activos' })).toHaveTextContent('Servicio: Esmaltado');
  });

  it('muestra el aviso cuando la respuesta viene truncada', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    turnos.mockResolvedValue({ turnos: [turno(1, '2026-10-17T09:00:00')], truncated: true, descartados: 0 });
    await aplicar((d) => escribir(d, 'Ana'));
    expect(await screen.findByText(/primeros 500 turnos/)).toBeInTheDocument();
    expect(screen.getByText(/Acota el rango/)).toBeInTheDocument();
  });

  it('sin resultados: texto propio y limpiar vuelve a hoy, vista de día y pide el día', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    await aplicar((d) => escribir(d, 'Zoe'));

    expect(await screen.findByText('No hay turnos con estos filtros.')).toBeInTheDocument();
    turnos.mockClear();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]);

    const s = useProAgendaStore.getState();
    expect(s.filtros).toEqual({ buscar: '', servicioId: null, desde: null, hasta: null });
    expect(s.vista).toBe('dia');
    await waitFor(() => expect(turnos).toHaveBeenCalledWith(1, { fecha: s.fecha }, expect.any(AbortSignal)));
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  });

  it('un error del pedido filtrado usa el copy del tipo y permite reintentar', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    turnos.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    await aplicar((d) => escribir(d, 'Ana'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).not.toHaveTextContent('boom');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Cliente1')).toBeInTheDocument();
  });

  it('cambiar de negocio borra los filtros y vuelve a la vista normal', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    useProAuthStore.setState({ vinculos: [vinculo, { ...vinculo, id: 2, negocioNombre: 'Negocio 2' }] });
    renderWithProviders(<AgendaPro />);
    await aplicar((d) => escribir(d, 'Ana'));
    await screen.findByRole('list', { name: 'Filtros activos' });

    act(() => useProAuthStore.getState().elegirVinculo(2));

    expect(useProAgendaStore.getState().filtros.buscar).toBe('');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument());
    expect(screen.queryByRole('list', { name: 'Filtros activos' })).toBeNull();
  });
});
