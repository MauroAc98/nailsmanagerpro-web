import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CobrosPagina, TurnoConCobro } from '@/services/cobrosService';

const mocks = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock('@/services/cobrosService', () => ({ cobrosService: { listar: mocks.listar } }));

import { useCobrosStore, POR_PAGINA } from './useCobrosStore';

const FILTROS = { turno: 'todos', pago: 'todos', periodo: 'todo', buscar: '' } as const;

const turno = (id: number) => ({ id, cobro: { pago: 'nada' } }) as unknown as TurnoConCobro;

const pagina = (ids: number[], extra: Partial<CobrosPagina> = {}): CobrosPagina => ({
  data: ids.map(turno),
  current_page: 1,
  per_page: POR_PAGINA,
  total: ids.length,
  last_page: 1,
  counts: { todos: ids.length, sena: 0, todo: 0, nada: ids.length, sinprecio: 0 },
  resumen: {
    sena_cobrada: 0, cobrado_finalizados: 0, falta_cobrar: 100, sin_precio_count: 0,
    sin_precio_estimado: 0, sena_en_pendientes: 0, cobrado_total: 0,
  },
  lista_bulk: { count: 0, total: 0, items: [] },
  ...extra,
});

const ids = () => useCobrosStore.getState().turnos.map(t => t.id);

beforeEach(() => {
  useCobrosStore.setState(useCobrosStore.getInitialState(), true);
  mocks.listar.mockReset();
});

describe('cargarPrimeraPagina', () => {
  it('pide la página 1 con los filtros y la ventana, y guarda lista, conteos y resumen', async () => {
    mocks.listar.mockResolvedValue(pagina([1, 2], { last_page: 3, total: 70 }));

    await useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, pago: 'sena', buscar: 'ana' });

    const query = mocks.listar.mock.calls[0][0];
    expect(query).toMatchObject({ page: 1, per_page: POR_PAGINA, pago: 'sena', turno: 'todos', periodo: 'todo', buscar: 'ana' });
    expect(query.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const s = useCobrosStore.getState();
    expect(ids()).toEqual([1, 2]);
    expect(s.pagina).toBe(1);
    expect(s.ultimaPagina).toBe(3);
    expect(s.total).toBe(70);
    expect(s.resumen.falta_cobrar).toBe(100);
    expect(s.cargando).toBe(false);
  });

  it('no manda `buscar` vacío', async () => {
    mocks.listar.mockResolvedValue(pagina([1]));
    await useCobrosStore.getState().cargarPrimeraPagina(FILTROS);
    expect(mocks.listar.mock.calls[0][0]).not.toHaveProperty('buscar');
  });

  it('descarta la respuesta de un pedido viejo si ya se pidió otro', async () => {
    let resolverViejo!: (p: CobrosPagina) => void;
    mocks.listar
      .mockImplementationOnce(() => new Promise<CobrosPagina>(r => { resolverViejo = r; }))
      .mockResolvedValueOnce(pagina([9]));

    const viejo = useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, buscar: 'a' });
    await useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, buscar: 'ab' });
    resolverViejo(pagina([1, 2, 3]));
    await viejo;

    expect(ids()).toEqual([9]);
    expect(useCobrosStore.getState().cargando).toBe(false);
  });

  it('un error muestra el mensaje y no vacía lo que ya se estaba viendo', async () => {
    mocks.listar.mockResolvedValueOnce(pagina([1, 2]));
    await useCobrosStore.getState().cargarPrimeraPagina(FILTROS);

    mocks.listar.mockRejectedValueOnce(new Error('sin red'));
    await useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, pago: 'sena' });

    expect(useCobrosStore.getState().error).toBeTruthy();
    expect(ids()).toEqual([1, 2]);
    expect(useCobrosStore.getState().cargando).toBe(false);
  });
});

describe('cargarSiguientePagina', () => {
  it('agrega la página siguiente con los mismos filtros', async () => {
    mocks.listar.mockResolvedValueOnce(pagina([1, 2], { last_page: 2 }));
    await useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, periodo: 'mes' });
    mocks.listar.mockResolvedValueOnce(pagina([3], { current_page: 2, last_page: 2 }));

    await useCobrosStore.getState().cargarSiguientePagina();

    expect(mocks.listar.mock.calls[1][0]).toMatchObject({ page: 2, periodo: 'mes' });
    expect(ids()).toEqual([1, 2, 3]);
    expect(useCobrosStore.getState().pagina).toBe(2);
    expect(useCobrosStore.getState().cargandoMas).toBe(false);
  });

  it('no pide nada si ya está en la última página', async () => {
    mocks.listar.mockResolvedValueOnce(pagina([1], { last_page: 1 }));
    await useCobrosStore.getState().cargarPrimeraPagina(FILTROS);

    await useCobrosStore.getState().cargarSiguientePagina();

    expect(mocks.listar).toHaveBeenCalledTimes(1);
  });

  it('no pide dos veces la misma página si ya hay un pedido en curso', async () => {
    mocks.listar.mockResolvedValueOnce(pagina([1], { last_page: 3 }));
    await useCobrosStore.getState().cargarPrimeraPagina(FILTROS);
    mocks.listar.mockImplementation(() => new Promise(() => {}));

    void useCobrosStore.getState().cargarSiguientePagina();
    void useCobrosStore.getState().cargarSiguientePagina();

    expect(mocks.listar).toHaveBeenCalledTimes(2); // la primera página + UNA siguiente
  });

  it('descarta la página que llega después de cambiar los filtros', async () => {
    mocks.listar.mockResolvedValueOnce(pagina([1, 2], { last_page: 2 }));
    await useCobrosStore.getState().cargarPrimeraPagina(FILTROS);
    let resolverVieja!: (p: CobrosPagina) => void;
    mocks.listar
      .mockImplementationOnce(() => new Promise<CobrosPagina>(r => { resolverVieja = r; }))
      .mockResolvedValueOnce(pagina([7]));

    const siguiente = useCobrosStore.getState().cargarSiguientePagina();
    await useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, pago: 'todo' });
    resolverVieja(pagina([3, 4], { current_page: 2, last_page: 2 }));
    await siguiente;

    expect(ids()).toEqual([7]);
  });
});

describe('recargar', () => {
  it('vuelve a pedir todas las páginas ya cargadas, con los mismos filtros, y las reemplaza', async () => {
    mocks.listar.mockResolvedValueOnce(pagina([1, 2], { last_page: 2 }));
    await useCobrosStore.getState().cargarPrimeraPagina({ ...FILTROS, pago: 'sinprecio' });
    mocks.listar.mockResolvedValueOnce(pagina([3, 4], { current_page: 2, last_page: 2 }));
    await useCobrosStore.getState().cargarSiguientePagina();
    mocks.listar.mockReset();
    mocks.listar
      .mockResolvedValueOnce(pagina([2], { last_page: 2 }))
      .mockResolvedValueOnce(pagina([4], { current_page: 2, last_page: 2 }));

    await useCobrosStore.getState().recargar();

    expect(mocks.listar.mock.calls.map(c => c[0].page)).toEqual([1, 2]);
    expect(mocks.listar.mock.calls.every(c => c[0].pago === 'sinprecio')).toBe(true);
    expect(ids()).toEqual([2, 4]);
    expect(useCobrosStore.getState().pagina).toBe(2);
  });

  it('sin nada cargado todavía no pide nada', async () => {
    await useCobrosStore.getState().recargar();
    expect(mocks.listar).not.toHaveBeenCalled();
  });
});
