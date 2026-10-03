import { beforeEach, describe, expect, it, vi } from 'vitest';

// buscarPorProfesional habla con el backend vía turnoService.buscarPorProfesional
// — se mockea para poder probar el efecto sobre el store sin red real, mismo
// patrón que useServicioStore.test.ts.
vi.mock('@/services/turnoService', async () => {
  const actual = await vi.importActual<typeof import('@/services/turnoService')>('@/services/turnoService');
  return {
    ...actual,
    turnoService: {
      ...actual.turnoService,
      buscarPorProfesional: vi.fn(),
      // Mockeado también acá — el test de exclusión mutua invoca la acción
      // real buscarPorServicio, que sin esto dispara un GET real vía
      // lib/api (no hay mock de red en este archivo).
      buscarPorServicio: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    },
  };
});

import { turnoService } from '@/services/turnoService';
import { useTurnoStore } from './useTurnoStore';

const mockedBuscarPorProfesional = vi.mocked(turnoService.buscarPorProfesional);

beforeEach(() => {
  mockedBuscarPorProfesional.mockReset();
  vi.mocked(turnoService.buscarPorServicio).mockClear();
  useTurnoStore.setState({
    turnosBusqueda: [],
    buscando: false,
    cargandoBusqueda: false,
    ultimaBusqueda: '',
    ultimoServicioId: null,
    ultimaFecha: null,
    ultimoProfesionalId: null,
  });
});

describe('buscarPorProfesional', () => {
  it('carga turnosBusqueda y guarda ultimoProfesionalId cuando se pasa un id', async () => {
    const turnosFake = [{ id: 1 }] as never;
    mockedBuscarPorProfesional.mockResolvedValue(turnosFake);

    await useTurnoStore.getState().buscarPorProfesional(7);

    expect(mockedBuscarPorProfesional).toHaveBeenCalledWith(7);
    expect(useTurnoStore.getState().turnosBusqueda).toEqual(turnosFake);
    expect(useTurnoStore.getState().ultimoProfesionalId).toBe(7);
    expect(useTurnoStore.getState().cargandoBusqueda).toBe(false);
  });

  it('limpia turnosBusqueda y ultimoProfesionalId cuando se pasa null', async () => {
    useTurnoStore.setState({ turnosBusqueda: [{ id: 1 }] as never, ultimoProfesionalId: 7 });

    await useTurnoStore.getState().buscarPorProfesional(null);

    expect(mockedBuscarPorProfesional).not.toHaveBeenCalled();
    expect(useTurnoStore.getState().turnosBusqueda).toEqual([]);
    expect(useTurnoStore.getState().ultimoProfesionalId).toBeNull();
  });

  it('es mutuamente excluyente con buscarPorNombre/buscarPorServicio/buscarPorFecha (resetea los otros criterios)', async () => {
    useTurnoStore.setState({
      ultimaBusqueda: 'ana',
      ultimoServicioId: 3,
      ultimaFecha: '2026-09-18',
    });
    mockedBuscarPorProfesional.mockResolvedValue([] as never);

    await useTurnoStore.getState().buscarPorProfesional(7);

    expect(useTurnoStore.getState().ultimaBusqueda).toBe('');
    expect(useTurnoStore.getState().ultimoServicioId).toBeNull();
    expect(useTurnoStore.getState().ultimaFecha).toBeNull();
  });

  it('buscarPorServicio resetea ultimoProfesionalId (exclusión en el otro sentido)', async () => {
    useTurnoStore.setState({ ultimoProfesionalId: 7 });

    await useTurnoStore.getState().buscarPorServicio(3);

    expect(useTurnoStore.getState().ultimoProfesionalId).toBeNull();
  });

  it('descarta una respuesta vieja si mientras tanto se pidió OTRO profesional', async () => {
    let resolvePrimera: (v: never) => void;
    const primera = new Promise<never>(resolve => { resolvePrimera = resolve; });
    mockedBuscarPorProfesional.mockReturnValueOnce(primera as never);
    mockedBuscarPorProfesional.mockResolvedValueOnce([{ id: 99 }] as never);

    const p1 = useTurnoStore.getState().buscarPorProfesional(7);
    const p2 = useTurnoStore.getState().buscarPorProfesional(9);

    resolvePrimera!([{ id: 1 }] as never);
    await Promise.all([p1, p2]);

    // La respuesta de la profesional 7 (la primera pedida) llega después de
    // resolver, pero ultimoProfesionalId ya es 9 — no debe pisar turnosBusqueda.
    expect(useTurnoStore.getState().ultimoProfesionalId).toBe(9);
  });
});

describe('limpiarBusqueda', () => {
  it('resetea ultimoProfesionalId junto con los demás criterios', () => {
    useTurnoStore.setState({ ultimoProfesionalId: 7, turnosBusqueda: [{ id: 1 }] as never });

    useTurnoStore.getState().limpiarBusqueda();

    expect(useTurnoStore.getState().ultimoProfesionalId).toBeNull();
    expect(useTurnoStore.getState().turnosBusqueda).toEqual([]);
  });
});

describe('cancelarTurno', () => {
  const refresco = { fetchTurnos: vi.fn().mockResolvedValue(undefined), fetchTurnosMes: vi.fn().mockResolvedValue(undefined) };
  beforeEach(() => {
    vi.mocked(turnoService.delete).mockReset();
    refresco.fetchTurnos.mockClear();
    useTurnoStore.setState({ ...refresco, fechaSeleccionada: '2026-09-17' });
  });

  it('un turno comun se cancela como siempre: sin alcance (Rule L)', async () => {
    vi.mocked(turnoService.delete).mockResolvedValue({ message: 'ok' });
    const r = await useTurnoStore.getState().cancelarTurno(5, 'Otro');
    expect(r).toEqual({ success: true });
    expect(turnoService.delete).toHaveBeenCalledWith(5, 'Otro');
  });

  it('todo el combo manda alcance grupo y devuelve los ids cancelados', async () => {
    vi.mocked(turnoService.delete).mockResolvedValue({ message: 'ok', cancelados: [5, 6] });
    const r = await useTurnoStore.getState().cancelarTurno(5, 'Otro', 'grupo');
    expect(turnoService.delete).toHaveBeenCalledWith(5, 'Otro', 'grupo');
    expect(r).toEqual({ success: true, cancelados: [5, 6] });
    expect(refresco.fetchTurnos).toHaveBeenCalled();
  });

  it('sin pendientes: mensaje claro y refresca la agenda', async () => {
    vi.mocked(turnoService.delete).mockRejectedValue({
      isAxiosError: true, response: { status: 422, data: { code: 'grupo_sin_pendientes', message: 'x' } },
    });
    const r = await useTurnoStore.getState().cancelarTurno(5, 'Otro', 'grupo');
    expect(r.success).toBe(false);
    expect(r.message).toBe('No queda nada para cancelar');
    expect(refresco.fetchTurnos).toHaveBeenCalled();
  });
});
