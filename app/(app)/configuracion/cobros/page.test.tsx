import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { CobroTurno, TurnoConCobro } from '@/services/cobrosService';

const mocks = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  query: '',
  pendientes: [] as unknown[],
  cargarPrimeraPagina: vi.fn(),
  cargarSiguientePagina: vi.fn(),
  recargar: vi.fn(),
  actualizar: vi.fn(),
  pedirPrecios: vi.fn(),
  confirmar: vi.fn(),
  avisar: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock('@/components/BackButton', () => ({ default: () => null }));
vi.mock('@/store/useCobrosStore', () => ({ useCobrosStore: () => mocks.state }));
vi.mock('@/store/usePendientesDeCobroStore', () => ({
  usePendientesDeCobroStore: () => ({ actualizarPrecios: mocks.actualizar, pendientes: mocks.pendientes, error: null }),
}));
// Servicio 1 tiene precio de lista ($18.000,00); el 2 no.
vi.mock('@/store/useServicioStore', () => ({
  useServiciosStore: () => ({
    servicios: [{ id: 1, nombre: 'Capping', precio: '18000' }, { id: 2, nombre: 'Soft gel', precio: null }],
    fetchServicios: vi.fn(),
  }),
}));
vi.mock('@/store/useProfesionalStore', () => ({
  useProfesionalStore: () => ({ profesionales: [{ id: 5, nombre: 'Natalia' }], fetchProfesionales: vi.fn() }),
}));
vi.mock('@/store/usePrecioServiciosStore', () => ({ pedirPreciosServicios: mocks.pedirPrecios }));
vi.mock('@/store/useToastStore', () => ({ showToast: mocks.toast }));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: mocks.avisar, confirmDialog: mocks.confirmar }));
// jsdom no mide layout: la lista virtualizada se reemplaza por una que dibuja
// todas las filas y avisa que se vieron hasta la última.
vi.mock('react-window', async () => {
  const React = await import('react');
  return {
    useDynamicRowHeight: () => ({}),
    List: ({ rowComponent: Row, rowCount, rowProps, onRowsRendered }: {
      rowComponent: React.ComponentType<Record<string, unknown>>;
      rowCount: number;
      rowProps: Record<string, unknown>;
      onRowsRendered?: (visible: { startIndex: number; stopIndex: number }) => void;
    }) => {
      React.useEffect(() => {
        onRowsRendered?.({ startIndex: 0, stopIndex: rowCount - 1 });
      });
      return React.createElement(
        'div',
        null,
        Array.from({ length: rowCount }, (_, index) =>
          React.createElement(Row, { key: index, index, style: {}, ariaAttributes: {}, ...rowProps }),
        ),
      );
    },
  };
});

import CobrosPage from './page';

const cobro = (o: Partial<CobroTurno> = {}): CobroTurno => ({
  finalizado: false, pago: 'nada', precio: null, cobrado: null, sena: 0, sena_compartida: false,
  falta_fila: null, precio_lista: 0, lista_completa: false, ...o,
});

interface Opts {
  nombre: string;
  fecha: string;
  estado?: 'confirmado' | 'completado';
  servicioId?: number;
  cobro?: Partial<CobroTurno>;
}
const turno = (id: number, { nombre, fecha, estado = 'completado', servicioId = 1, cobro: c }: Opts): TurnoConCobro =>
  ({
    id, fecha_hora: fecha, estado, profesional_id: 5,
    cliente: { nombre, apellido: 'Test' },
    servicios: [{ id: servicioId, nombre: servicioId === 1 ? 'Capping' : 'Soft gel' }],
    cobro: cobro({ finalizado: estado === 'completado', ...c }),
  }) as unknown as TurnoConCobro;

const estadoBase = () => ({
  turnos: [] as TurnoConCobro[],
  pagina: 1, ultimaPagina: 1, total: 0,
  counts: { todos: 0, sena: 0, todo: 0, nada: 0, sinprecio: 0 },
  resumen: {
    sena_cobrada: 0, cobrado_finalizados: 0, falta_cobrar: 0, sin_precio_count: 0,
    sin_precio_estimado: 0, sena_en_pendientes: 0, cobrado_total: 0,
  },
  listaBulk: { count: 0, total: 0, items: [] as { turno_id: number; precios: { servicio_id: number; precio: number }[] }[] },
  cargando: false, cargandoMas: false, error: null as string | null,
  cargarPrimeraPagina: mocks.cargarPrimeraPagina,
  cargarSiguientePagina: mocks.cargarSiguientePagina,
  recargar: mocks.recargar,
});
const poner = (cambios: Record<string, unknown>) => { mocks.state = { ...mocks.state, ...cambios }; };

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <CobrosPage />
    </NextIntlClientProvider>,
  );
}

const FILTROS = { turno: 'todos', pago: 'sinprecio', periodo: 'todo', buscar: '' };
const FILTROS_PROXIMOS = { turno: 'confirmado', pago: 'todos', periodo: 'todo', buscar: '' };
const FILTROS_COBRADOS = { turno: 'finalizado', pago: 'todo', periodo: 'todo', buscar: '' };
const ultimaCarga = () => mocks.cargarPrimeraPagina.mock.calls.at(-1)![0];
const pestana = (nombre: RegExp) => screen.getByRole('tab', { name: nombre });

beforeEach(() => {
  mocks.state = estadoBase();
  mocks.query = '';
  mocks.pendientes = [];
  for (const m of [mocks.cargarPrimeraPagina, mocks.cargarSiguientePagina, mocks.recargar, mocks.actualizar, mocks.pedirPrecios, mocks.confirmar, mocks.avisar, mocks.toast]) {
    m.mockReset();
  }
  mocks.cargarPrimeraPagina.mockResolvedValue(undefined);
  mocks.recargar.mockResolvedValue(undefined);
  mocks.actualizar.mockResolvedValue({ success: true });
  mocks.confirmar.mockResolvedValue(true);
});

describe('Cobros — pestañas (cada una fija los filtros del backend)', () => {
  it('al abrir muestra "Por resolver": atendidos sin precio, sin otros filtros', () => {
    renderPage();
    expect(mocks.cargarPrimeraPagina).toHaveBeenCalledTimes(1);
    expect(ultimaCarga()).toEqual(FILTROS);
    expect(pestana(/^Por resolver/)).toHaveAttribute('aria-selected', 'true');
  });

  it('un valor de ?pago= que no es cobrados cae en "Por resolver"', () => {
    mocks.query = 'pago=cualquiera';
    renderPage();
    expect(ultimaCarga()).toEqual(FILTROS);
  });

  it('?pago=todo abre en "Cobrados"', () => {
    mocks.query = 'pago=todo';
    renderPage();
    expect(ultimaCarga()).toEqual(FILTROS_COBRADOS);
    expect(pestana(/^Cobrados/)).toHaveAttribute('aria-selected', 'true');
  });

  it('"Por resolver" lleva el contador de pendientes de cobro', () => {
    mocks.pendientes = [{ id: 1 }, { id: 2 }];
    renderPage();
    expect(pestana(/^Por resolver/)).toHaveTextContent('Por resolver2');
  });

  it('"Próximos" pide los confirmados y cuenta con seña y sin seña', () => {
    poner({ counts: { todos: 255, sena: 41, todo: 0, nada: 214, sinprecio: 0 } });
    renderPage();
    fireEvent.click(pestana(/^Próximos/));
    expect(ultimaCarga()).toEqual(FILTROS_PROXIMOS);
    expect(screen.getByText('255 turnos agendados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Con seña · 41' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sin seña · 214' })).toBeInTheDocument();
  });

  it('elegir "Sin seña" vuelve a pedir los confirmados sin seña', () => {
    renderPage();
    fireEvent.click(pestana(/^Próximos/));
    fireEvent.click(screen.getByRole('button', { name: /^Sin seña/ }));
    expect(ultimaCarga()).toEqual({ ...FILTROS_PROXIMOS, pago: 'nada' });
    expect(screen.getByRole('button', { name: /^Sin seña/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Cobrados" pide los finalizados con plata y muestra el total del período', () => {
    poner({
      counts: { todos: 40, sena: 0, todo: 28, nada: 0, sinprecio: 0 },
      resumen: { ...estadoBase().resumen, cobrado_total: 27000, sena_en_pendientes: 6000 },
    });
    renderPage();
    fireEvent.click(pestana(/^Cobrados/));
    expect(ultimaCarga()).toEqual(FILTROS_COBRADOS);
    const cobrado = within(screen.getByTestId('resumen-cobrado'));
    expect(cobrado.getByText('$27.000,00')).toBeInTheDocument();
    expect(cobrado.getByText(/28 turnos/)).toBeInTheDocument();
    expect(cobrado.getByText(/incluye .*6.000,00 en señas/)).toBeInTheDocument();
  });

  it('sin señas pendientes "Cobrados" no aclara nada', () => {
    renderPage();
    fireEvent.click(pestana(/^Cobrados/));
    expect(screen.queryByText(/en señas/)).not.toBeInTheDocument();
  });

  it('el período se elige desde una hoja en "Cobrados"; tocar el fondo la cierra sin pedir nada', () => {
    renderPage();
    fireEvent.click(pestana(/^Cobrados/));
    fireEvent.click(screen.getByRole('button', { name: 'Todo el período' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Período' })).getByRole('button', { name: 'Este mes' }));
    expect(ultimaCarga()).toEqual({ ...FILTROS_COBRADOS, periodo: 'mes' });

    const pedidos = mocks.cargarPrimeraPagina.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    fireEvent.click(screen.getByTestId('hoja-fondo'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.cargarPrimeraPagina).toHaveBeenCalledTimes(pedidos);
  });

  describe('búsqueda', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('se abre desde el botón y pide recién cuando se deja de tipear', () => {
      renderPage();
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Buscar cliente' }));
      const pedidos = mocks.cargarPrimeraPagina.mock.calls.length;

      fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nombre del cliente' }), { target: { value: 'sofia' } });
      expect(mocks.cargarPrimeraPagina).toHaveBeenCalledTimes(pedidos); // todavía no

      act(() => { vi.advanceTimersByTime(500); });
      expect(mocks.cargarPrimeraPagina).toHaveBeenCalledTimes(pedidos + 1);
      expect(ultimaCarga()).toEqual({ ...FILTROS, buscar: 'sofia' });
    });

    it('cerrar la búsqueda limpia el texto y vuelve a pedir sin él', () => {
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Buscar cliente' }));
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sofia' } });
      act(() => { vi.advanceTimersByTime(500); });

      fireEvent.click(screen.getByRole('button', { name: 'Buscar cliente' }));
      act(() => { vi.advanceTimersByTime(500); });

      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(ultimaCarga().buscar).toBe('');
    });
  });
});

describe('Cobros — resumen y lista', () => {
  it('un turno futuro sin seña dice "Sin seña" y uno atendido en cero dice "Sin cobro"', () => {
    poner({
      turnos: [
        turno(1, { nombre: 'Lucía', fecha: '2026-10-09 09:00:00', estado: 'confirmado', cobro: { pago: 'nada' } }),
        turno(2, { nombre: 'Marta', fecha: '2026-10-05 12:00:00', cobro: { pago: 'nada', cobrado: 0, precio: 0 } }),
      ],
    });
    renderPage();
    expect(within(screen.getByText('Lucía Test').parentElement as HTMLElement).getByText('Sin seña')).toBeInTheDocument();
    expect(within(screen.getByText('Marta Test').parentElement as HTMLElement).getByText('Sin cobro')).toBeInTheDocument();
  });

  it('muestra cliente, servicio, profesional, estado del turno y un solo estado de pago', () => {
    poner({
      turnos: [
        turno(1, { nombre: 'Camila', fecha: '2026-10-09 15:30:00', estado: 'confirmado', cobro: { pago: 'sena', sena: 6000, falta_fila: 12000 } }),
        turno(2, { nombre: 'Paula', fecha: '2026-10-07 17:30:00', cobro: { pago: 'todo', cobrado: 21000, precio: 21000 } }),
      ],
    });
    renderPage();
    const camila = screen.getByText('Camila Test').parentElement as HTMLElement;
    expect(within(camila).getByText('Capping')).toBeInTheDocument();
    expect(within(camila).getByText(/con Natalia/)).toBeInTheDocument();
    expect(within(camila).getByText(/Confirmado$/)).toBeInTheDocument();
    expect(within(camila).getByText('Con seña')).toBeInTheDocument();
    expect(within(camila).getByText('$6.000,00')).toBeInTheDocument();
    expect(within(camila).getByText('Falta $12.000,00')).toBeInTheDocument();
    const paula = screen.getByText('Paula Test').parentElement as HTMLElement;
    expect(within(paula).getByText(/Finalizado$/)).toBeInTheDocument();
    expect(within(paula).getByText('Cobrado')).toBeInTheDocument();
    expect(within(paula).getByText('$21.000,00')).toBeInTheDocument();
  });

  it('un finalizado con seña aclara cuánto de lo cobrado fue seña', () => {
    poner({ turnos: [turno(1, { nombre: 'Julieta', fecha: '2026-10-05 12:00:00', cobro: { pago: 'todo', cobrado: 28000, sena: 6000 } })] });
    renderPage();
    const fila = screen.getByText('Julieta Test').parentElement as HTMLElement;
    expect(within(fila).getByText('$28.000,00')).toBeInTheDocument();
    expect(within(fila).getByText('incluye seña $6.000,00')).toBeInTheDocument();
  });

  it('sin resultados en "Por resolver" avisa que está todo al día', () => {
    renderPage();
    expect(screen.getByText('No hay turnos esperando precio. ¡Todo al día!')).toBeInTheDocument();
  });

  it('mientras carga la primera página muestra el loader (no un texto) y no dice que está vacío', () => {
    poner({ cargando: true });
    renderPage();
    const loader = screen.getByRole('status', { name: 'Cargando...' });
    expect(loader).toHaveClass('loader-spinner');
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument();
    expect(screen.queryByText('No hay turnos con esos filtros.')).not.toBeInTheDocument();
  });

  it('al pedir la página siguiente muestra el loader debajo de lo ya cargado', () => {
    poner({
      turnos: [turno(1, { nombre: 'Camila', fecha: '2026-10-09 15:30:00', estado: 'confirmado' })],
      ultimaPagina: 2,
      cargandoMas: true,
    });
    renderPage();
    expect(screen.getByText('Camila Test')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando más...' })).toHaveClass('loader-spinner');
    expect(screen.queryByText('Cargando más...')).not.toBeInTheDocument();
  });

  it('sin cargar nada no hay loader', () => {
    renderPage();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('muestra el error del pedido', () => {
    poner({ error: 'Sin conexión' });
    renderPage();
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });

  it('pide la página siguiente cuando se llega al final de lo cargado', () => {
    poner({ turnos: [turno(1, { nombre: 'Camila', fecha: '2026-10-09 15:30:00', estado: 'confirmado' })], ultimaPagina: 2 });
    renderPage();
    expect(mocks.cargarSiguientePagina).toHaveBeenCalled();
  });

  it('avisa cuántos turnos sin precio hay en el conjunto completo', () => {
    poner({ resumen: { ...estadoBase().resumen, sin_precio_count: 1, sin_precio_estimado: 18000 } });
    renderPage();
    expect(screen.getByText('1 turno sin precio cargado')).toBeInTheDocument();
    expect(screen.getByText(/estimado a precio de lista \$18\.000/)).toBeInTheDocument();
  });
});

describe('Cobros — cobrar un turno', () => {
  beforeEach(() => {
    poner({
      turnos: [turno(1, { nombre: 'Mica', fecha: '2026-09-10 10:00:00', cobro: { pago: 'sinprecio', lista_completa: true, precio_lista: 18000 } })],
    });
  });

  it('un turno sin precio ofrece usar el de lista, con su monto', () => {
    renderPage();
    const fila = screen.getByText('Mica Test').parentElement as HTMLElement;
    expect(within(fila).getByText('Lista $18.000,00')).toBeInTheDocument();
  });

  it('"Usar precio de lista" pide confirmar, guarda y recarga lo cargado', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Usar precio de lista' }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith(1, [{ servicio_id: 1, precio: 18000 }]));
    expect(mocks.confirmar.mock.calls[0][0]).toContain('Mica');
    expect(mocks.confirmar.mock.calls[0][0]).toContain('$18.000,00');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('Precio guardado'));
    expect(mocks.recargar).toHaveBeenCalledTimes(1);
  });

  it('si se cancela la confirmación no guarda nada', async () => {
    mocks.confirmar.mockResolvedValue(false);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Usar precio de lista' }));
    await waitFor(() => expect(mocks.confirmar).toHaveBeenCalled());
    expect(mocks.actualizar).not.toHaveBeenCalled();
  });

  it('"Cobrar" abre la hoja de precios y guarda lo que se cargó', async () => {
    mocks.pedirPrecios.mockResolvedValue([{ servicio_id: 1, precio: 15000 }]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith(1, [{ servicio_id: 1, precio: 15000 }]));
    expect(mocks.pedirPrecios).toHaveBeenCalledWith(
      [{ servicio_id: 1, nombre: 'Capping', precioReferencia: 18000 }],
      expect.objectContaining({ cliente: 'Mica Test', modo: 'cargar' }),
    );
    await waitFor(() => expect(mocks.recargar).toHaveBeenCalledTimes(1));
  });

  it('si se cierra la hoja de precios no guarda ni recarga', async () => {
    mocks.pedirPrecios.mockResolvedValue(null);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(mocks.pedirPrecios).toHaveBeenCalled());
    expect(mocks.actualizar).not.toHaveBeenCalled();
    expect(mocks.recargar).not.toHaveBeenCalled();
  });

  it('un turno sin precio de lista en algún servicio no ofrece usarlo', () => {
    poner({
      turnos: [turno(1, { nombre: 'Luz', fecha: '2026-09-14 12:00:00', servicioId: 2, cobro: { pago: 'sinprecio', lista_completa: false } })],
    });
    renderPage();
    const fila = screen.getByText('Luz Test').parentElement as HTMLElement;
    expect(within(fila).getByText('Sin precio de lista')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar precio de lista' })).not.toBeInTheDocument();
  });
});

describe('Cobros — usar precio de lista en todos', () => {
  const BOTON = /Usar precio de lista en los 3 turnos/;
  beforeEach(() => {
    poner({
      resumen: { ...estadoBase().resumen, sin_precio_count: 3, sin_precio_estimado: 54000 },
      listaBulk: {
        count: 3,
        total: 54000,
        items: [
          { turno_id: 3, precios: [{ servicio_id: 1, precio: 18000 }] },
          { turno_id: 2, precios: [{ servicio_id: 1, precio: 18000 }] },
          { turno_id: 1, precios: [{ servicio_id: 1, precio: 18000 }] },
        ],
      },
    });
  });

  it('el botón explica para qué sirve y usa el conjunto completo, no lo cargado', () => {
    renderPage();
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument();
    expect(screen.getByText(/Para cuando cobraste lo habitual/)).toBeInTheDocument();
  });

  it('pide confirmación con la cantidad y el total, y si se cancela no guarda nada', async () => {
    mocks.confirmar.mockResolvedValue(false);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    await waitFor(() => expect(mocks.confirmar).toHaveBeenCalledTimes(1));
    expect(mocks.confirmar.mock.calls[0][0]).toContain('3 turnos');
    expect(mocks.confirmar.mock.calls[0][0]).toContain('$54.000,00');
    expect(mocks.actualizar).not.toHaveBeenCalled();
  });

  it('al confirmar registra cada turno, avisa una sola vez y recarga la lista', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(3));
    expect(mocks.actualizar).toHaveBeenCalledWith(3, [{ servicio_id: 1, precio: 18000 }]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('3 turnos cobrados'));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.recargar).toHaveBeenCalledTimes(1);
  });

  it('si uno falla se corta y cuenta cuántos se alcanzaron a registrar', async () => {
    mocks.actualizar
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'Error de red' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    await waitFor(() => expect(mocks.avisar).toHaveBeenCalledTimes(1));
    expect(mocks.actualizar).toHaveBeenCalledTimes(2);
    expect(mocks.avisar.mock.calls[0][0]).toContain('1 de 3');
    expect(mocks.avisar.mock.calls[0][0]).toContain('Error de red');
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.recargar).toHaveBeenCalledTimes(1);
  });

  it('con menos de dos turnos no aparece (cada fila ya tiene su botón)', () => {
    poner({ listaBulk: { count: 1, total: 18000, items: [{ turno_id: 1, precios: [{ servicio_id: 1, precio: 18000 }] }] } });
    renderPage();
    expect(screen.queryByRole('button', { name: /Usar precio de lista en los/ })).not.toBeInTheDocument();
  });
});
