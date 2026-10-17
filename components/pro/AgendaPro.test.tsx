import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '@/test/render';
import { proService } from '@/services/proService';
import { vaciarCachesPro } from '@/lib/pro/caches';
import { hoyDelDispositivo } from '@/lib/pro/hoy';
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
    expect(screen.getByText('Hola, Ana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument();
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

  it('la lista vive en una hoja con título serif y botón Filtrar a su derecha', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    renderWithProviders(<AgendaPro />);
    const titulo = screen.getByText(/^Turnos (de hoy|del )/);
    expect(titulo.style.fontSize).toBe('19px');
    expect(titulo.style.fontFamily).not.toBe('');
    const boton = screen.getByRole('button', { name: 'Filtrar' });
    expect(titulo.parentElement).toBe(boton.parentElement);
    expect(boton.querySelector('svg')).not.toBeNull();
    // La tira queda arriba y la lista dentro de la hoja.
    expect(screen.getByTestId('week-day-2026-10-17')).toBeInTheDocument();
    expect((await screen.findByText('Cliente1')).closest('[data-testid="hoja-turnos"]')).not.toBeNull();
  });

  it('el título dice "de hoy" solo si la fecha elegida es hoy', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    const hoy = hoyDelDispositivo();
    useProAgendaStore.getState().setFecha(hoy);
    const { unmount } = renderWithProviders(<AgendaPro />);
    expect(screen.getByText('Turnos de hoy')).toBeInTheDocument();
    unmount();
    useProAgendaStore.getState().setFecha('2000-10-14');
    renderWithProviders(<AgendaPro />);
    expect(screen.getByText(/^Turnos del .*14/)).toBeInTheDocument();
  });

  it('con filtros activos el título de la hoja es Resultados', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    useProAgendaStore.getState().setFiltros({ buscar: 'Ana', servicioId: null, desde: null, hasta: null });
    renderWithProviders(<AgendaPro />);
    expect(screen.getByText('Resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros: 1 activo' })).toBeInTheDocument();
  });

  it('ya no hay selector día/mes ni vista mensual propia', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    expect(screen.queryByRole('group', { name: 'Vista de la agenda' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mes' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-pressed]')).toBeNull();
    // El único botón de filtros vive en la hoja.
    expect(screen.getAllByRole('button', { name: 'Filtrar' })).toHaveLength(1);
  });

  it('una fecha elegida fuera de la semana mostrada mueve la tira a esa semana', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    useProAgendaStore.getState().setFecha('2026-11-04');
    await waitFor(() => expect(screen.getByTestId('week-day-2026-11-04')).toBeInTheDocument());
  });
});

describe('AgendaPro: calendario "Elegir fecha"', () => {
  const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Ver calendario completo' }));

  it('"Ver calendario" abre la hoja con el mes de la fecha elegida y conserva la tira y la lista', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([turno(1, '2026-10-17T09:00:00')]));
    renderWithProviders(<AgendaPro />);
    abrir();
    const dialogo = await screen.findByRole('dialog', { name: 'Elegir fecha' });
    expect(within(dialogo).getByText('octubre 2026')).toBeInTheDocument();
    expect(within(dialogo).getByTestId('cal-dia-2026-10-17')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('week-day-2026-10-17')).toBeInTheDocument();
    expect(await screen.findByText('Cliente1')).toBeInTheDocument();
  });

  it('muestra las marcas del mes (solo cantidades) en la grilla', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [{ fecha: '2099-10-14', cantidad: 2 }], descartados: 0 });
    useProAgendaStore.getState().setFecha('2099-10-01');
    renderWithProviders(<AgendaPro />);
    abrir();
    expect(await screen.findByRole('button', { name: /14 de octubre.*2 turnos/ })).toHaveTextContent('2');
  });

  it('elegir un día fija la fecha, cierra la hoja y pide la lista de ese día', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    abrir();
    fireEvent.click(await screen.findByTestId('cal-dia-2026-10-22'));

    expect(useProAgendaStore.getState().fecha).toBe('2026-10-22');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('week-day-2026-10-22')).toBeInTheDocument();
    await waitFor(() => expect(turnos).toHaveBeenLastCalledWith(1, { fecha: '2026-10-22' }, expect.any(AbortSignal)));
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('navegar de mes pide las marcas del mes nuevo; cerrar sin elegir deja la fecha y al reabrir vuelve a su mes', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    const marcas = vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [], descartados: 0 });
    renderWithProviders(<AgendaPro />);
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('noviembre 2026')).toBeInTheDocument();
    await waitFor(() => expect(marcas).toHaveBeenCalledWith(1, '2026-11', expect.any(AbortSignal)));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useProAgendaStore.getState().fecha).toBe('2026-10-17');

    abrir();
    expect(await screen.findByText('octubre 2026')).toBeInTheDocument();
  });

  it('mientras cargan las marcas de un mes muestra el spinner sin tapar la grilla', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    vi.spyOn(proService, 'marcas').mockImplementation((_id, mes) =>
      mes === '2026-11' ? new Promise(() => {}) : Promise.resolve({ dias: [], descartados: 0 }),
    );
    renderWithProviders(<AgendaPro />);
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }));
    const dialogo = screen.getByRole('dialog', { name: 'Elegir fecha' });
    expect(within(dialogo).getByRole('status', { name: 'Cargando turnos' })).toBeInTheDocument();
    expect(within(dialogo).getByTestId('cal-dia-2026-11-10')).toBeInTheDocument();
  });

  it('si fallan las marcas del mes muestra el error del tipo y permite reintentar', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    let fallo = true;
    const marcas = vi.spyOn(proService, 'marcas').mockImplementation(async (_id, mes) => {
      if (mes === '2026-11' && fallo) {
        fallo = false;
        throw new Error('boom');
      }
      return { dias: mes === '2026-11' ? [{ fecha: '2026-11-05', cantidad: 2 }] : [], descartados: 0 };
    });
    renderWithProviders(<AgendaPro />);
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }));
    const dialogo = screen.getByRole('dialog', { name: 'Elegir fecha' });
    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).not.toHaveTextContent('boom');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Reintentar' }));
    expect(await within(dialogo).findByRole('button', { name: /5 de noviembre.*2 turnos/ })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('alert')).toBeNull();
    expect(marcas).toHaveBeenCalledWith(1, '2026-11', expect.any(AbortSignal));
  });
});

describe('AgendaPro con filtros', () => {
  const servicios = { servicios: [{ id: 3, nombre: 'Esmaltado', duracion_minutos: null, categoria: null }], descartados: 0 };

  async function aplicar(cambios: (dialogo: HTMLElement) => void) {
    fireEvent.click(screen.getByRole('button', { name: /^Filtr/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Filtrar turnos' });
    cambios(dialogo);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ver resultados' }));
  }
  // La fecha se elige en el calendario, que es una hoja hermana de la de filtros.
  const elegirFecha = (d: HTMLElement, fecha: string) => {
    fireEvent.click(within(d).getByRole('button', { name: 'Elegir fecha' }));
    fireEvent.click(screen.getByTestId(`cal-dia-${fecha}`));
  };
  const escribir = (d: HTMLElement, texto: string) =>
    fireEvent.change(within(d).getByLabelText('Buscar por nombre...'), { target: { value: texto } });

  beforeEach(() => {
    vi.spyOn(proService, 'servicios').mockResolvedValue(servicios);
  });

  it('el botón Filtros abre la hoja y al cerrarla el foco vuelve al botón', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    const boton = screen.getByRole('button', { name: 'Filtrar' });
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
      elegirFecha(d, '2026-10-01');
    });

    expect(await screen.findByRole('button', { name: 'Filtros: 2 activos' })).toBeInTheDocument();
    const activos = screen.getByRole('list', { name: 'Filtros activos' });
    expect(activos).toHaveTextContent('Nombre: Ana');
    expect(activos).toHaveTextContent(/Fecha: .*1.*oct/i);
  });

  it('con una fecha elegida envía desde = hasta = esa fecha y no pide el día de la tira', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    turnos.mockResolvedValue(lista([turno(2, '2026-10-02T10:00:00'), turno(1, '2026-10-01T09:00:00')]));

    await aplicar((d) => {
      elegirFecha(d, '2026-10-01');
    });

    await screen.findByText('Cliente2');
    expect(turnos).toHaveBeenLastCalledWith(1, { desde: '2026-10-01', hasta: '2026-10-01' }, expect.any(AbortSignal));
    expect(screen.queryByTestId('week-day-2026-10-17')).toBeNull();
  });

  it('elegir un servicio envía servicio_id y lo nombra en los filtros activos', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Filtrar turnos' });
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Servicio: Todos' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Esmaltado' }));
    expect(screen.queryByRole('dialog', { name: 'Servicio' })).toBeNull();
    expect(within(dialogo).getByRole('button', { name: 'Servicio: Esmaltado' })).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Ver resultados' }));

    await waitFor(() =>
      expect(turnos).toHaveBeenLastCalledWith(1, { desde: '2026-10-17', hasta: '2026-10-17', servicio_id: 3 }, expect.any(AbortSignal)),
    );
    expect(await screen.findByRole('list', { name: 'Filtros activos' })).toHaveTextContent('Servicio: Esmaltado');
  });

  it('el borrador de fecha y servicio parte de lo guardado cada vez que se abre la hoja', async () => {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    useProAgendaStore.getState().setFiltros({ servicioId: 3, desde: '2026-10-01', hasta: '2026-10-01' });
    renderWithProviders(<AgendaPro />);
    fireEvent.click(screen.getByRole('button', { name: /^Filtr/ }));
    const dialogo = await screen.findByRole('dialog', { name: 'Filtrar turnos' });
    expect(await within(dialogo).findByRole('button', { name: 'Servicio: Esmaltado' })).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Quitar fecha' }));
    expect(within(dialogo).getByRole('button', { name: 'Elegir fecha' })).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }));

    fireEvent.click(screen.getByRole('button', { name: /^Filtr/ }));
    const otra = await screen.findByRole('dialog', { name: 'Filtrar turnos' });
    expect(within(otra).getByRole('button', { name: 'Quitar fecha' })).toBeInTheDocument();
    expect(useProAgendaStore.getState().filtros.desde).toBe('2026-10-01');
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

  it('sin resultados: texto propio y limpiar vuelve a hoy y pide el día', async () => {
    const turnos = vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    renderWithProviders(<AgendaPro />);
    await screen.findByText('No hay turnos para este día.');
    await aplicar((d) => escribir(d, 'Zoe'));

    expect(await screen.findByText('No hay turnos con estos filtros.')).toBeInTheDocument();
    turnos.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    const s = useProAgendaStore.getState();
    expect(s.filtros).toEqual({ buscar: '', servicioId: null, desde: null, hasta: null });
    await waitFor(() => expect(turnos).toHaveBeenCalledWith(1, { fecha: s.fecha }, expect.any(AbortSignal)));
    expect(screen.getByRole('button', { name: 'Filtrar' })).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filtrar' })).toBeInTheDocument());
    expect(screen.queryByRole('list', { name: 'Filtros activos' })).toBeNull();
  });
});

describe('AgendaPro: hojas de fecha y servicio abiertas desde Filtros', () => {
  // Capa de la hoja que contiene el elemento (la del BottomSheet).
  const capaDe = (el: HTMLElement) => Number(el.closest<HTMLElement>('[style*="z-index"]')?.style.zIndex);

  async function abrirFiltros() {
    vi.spyOn(proService, 'turnos').mockResolvedValue(lista([]));
    vi.spyOn(proService, 'servicios').mockResolvedValue({ servicios: [{ id: 3, nombre: 'Esmaltado', duracion_minutos: null, categoria: null }], descartados: 0 });
    renderWithProviders(<AgendaPro />);
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    return screen.findByRole('dialog', { name: 'Filtrar turnos' });
  }

  it('el calendario queda por encima de la hoja de Filtros, con su fondo también', async () => {
    const filtros = await abrirFiltros();
    fireEvent.click(within(filtros).getByRole('button', { name: 'Elegir fecha' }));
    const calendario = await screen.findByRole('dialog', { name: 'Elegir fecha' });

    expect(capaDe(calendario)).toBeGreaterThan(capaDe(filtros));
    expect(Number(screen.getByTestId('fondo-calendario').style.zIndex)).toBeGreaterThan(capaDe(filtros));
  });

  it('la hoja de servicio queda por encima de la hoja de Filtros, con su fondo también', async () => {
    const filtros = await abrirFiltros();
    fireEvent.click(await within(filtros).findByRole('button', { name: 'Servicio: Todos' }));
    const servicio = await screen.findByRole('dialog', { name: 'Servicio' });

    expect(capaDe(servicio)).toBeGreaterThan(capaDe(filtros));
    expect(Number(screen.getByTestId('fondo-servicio').style.zIndex)).toBeGreaterThan(capaDe(filtros));
  });

  it('elegir en el calendario no toca la fecha de la tira ni los filtros guardados hasta Ver resultados', async () => {
    const filtros = await abrirFiltros();
    fireEvent.click(within(filtros).getByRole('button', { name: 'Elegir fecha' }));
    fireEvent.click(await screen.findByTestId('cal-dia-2026-10-22'));

    expect(screen.queryByRole('dialog', { name: 'Elegir fecha' })).toBeNull();
    expect(within(filtros).getByRole('button', { name: /22/ })).toBeInTheDocument();
    expect(useProAgendaStore.getState().fecha).toBe('2026-10-17');
    expect(useProAgendaStore.getState().filtros.desde).toBeNull();
  });

  it('las marcas del calendario se piden solo con el calendario abierto, del mes que se ve', async () => {
    const marcas = vi.spyOn(proService, 'marcas').mockResolvedValue({ dias: [{ fecha: '2026-11-05', cantidad: 2 }], descartados: 0 });
    const filtros = await abrirFiltros();
    expect(marcas).not.toHaveBeenCalledWith(1, '2026-11', expect.any(AbortSignal));

    fireEvent.click(within(filtros).getByRole('button', { name: 'Elegir fecha' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }));
    expect(await screen.findByRole('button', { name: /5 de noviembre.*2 turnos/ })).toBeInTheDocument();
    expect(marcas).toHaveBeenCalledWith(1, '2026-11', expect.any(AbortSignal));
  });

  it('el calendario de Filtros resalta la fecha del borrador, no la de la tira', async () => {
    const filtros = await abrirFiltros();
    fireEvent.click(within(filtros).getByRole('button', { name: 'Elegir fecha' }));
    await screen.findByRole('dialog', { name: 'Elegir fecha' });
    expect(screen.getByTestId('cal-dia-2026-10-17')).toHaveAttribute('aria-pressed', 'false');
  });
});
