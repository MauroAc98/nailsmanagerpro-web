import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { Turno } from '@/services/turnoService';

const mocks = vi.hoisted(() => ({
  turnos: [] as unknown[],
  query: '',
  actualizar: vi.fn(),
  fetchCobros: vi.fn(),
  confirmar: vi.fn(),
  avisar: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock('@/components/BackButton', () => ({ default: () => null }));
vi.mock('@/store/useCobrosStore', () => ({
  useCobrosStore: () => ({ turnos: mocks.turnos, loading: false, error: null, fetchCobros: mocks.fetchCobros }),
}));
vi.mock('@/store/usePendientesDeCobroStore', () => ({
  usePendientesDeCobroStore: () => ({ actualizarPrecios: mocks.actualizar }),
}));
// Servicio 1 tiene precio de lista ($18.000); el 2 no.
vi.mock('@/store/useServicioStore', () => ({
  useServiciosStore: () => ({
    servicios: [{ id: 1, nombre: 'Capping', precio: '18000' }, { id: 2, nombre: 'Soft gel', precio: null }],
    fetchServicios: vi.fn(),
  }),
}));
vi.mock('@/store/useProfesionalStore', () => ({
  useProfesionalStore: () => ({ profesionales: [{ id: 5, nombre: 'Natalia' }], fetchProfesionales: vi.fn() }),
}));
vi.mock('@/store/usePrecioServiciosStore', () => ({ pedirPreciosServicios: vi.fn() }));
vi.mock('@/store/useToastStore', () => ({ showToast: mocks.toast }));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: mocks.avisar, confirmDialog: mocks.confirmar }));

import CobrosPage from './page';

interface Opts {
  nombre: string;
  fecha: string;
  estado?: 'confirmado' | 'completado';
  servicioId?: number;
  precio?: string | null;
  sena?: unknown;
}
const turno = (id: number, { nombre, fecha, estado = 'completado', servicioId = 1, precio = null, sena }: Opts) =>
  ({
    id, fecha_hora: fecha, estado, profesional_id: 5,
    cliente: { nombre, apellido: 'Test' },
    servicios: [{ id: servicioId, nombre: servicioId === 1 ? 'Capping' : 'Soft gel', pivot: { precio } }],
    ...(sena !== undefined ? { sena } : {}),
  }) as unknown as Turno;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <CobrosPage />
    </NextIntlClientProvider>,
  );
}

const BOTON_TODOS = /Usar precio de lista en los 3 turnos/;
const sinPrecio = () => [
  turno(1, { nombre: 'Mica', fecha: '2026-09-10 10:00:00' }),
  turno(2, { nombre: 'Ana', fecha: '2026-09-12 11:00:00' }),
  turno(3, { nombre: 'Luz', fecha: '2026-09-14 12:00:00' }),
];

beforeEach(() => {
  mocks.turnos = sinPrecio();
  mocks.query = '';
  mocks.actualizar.mockReset();
  mocks.actualizar.mockResolvedValue({ success: true });
  mocks.fetchCobros.mockReset();
  mocks.fetchCobros.mockResolvedValue(undefined);
  mocks.confirmar.mockReset();
  mocks.confirmar.mockResolvedValue(true);
  mocks.avisar.mockReset();
  mocks.toast.mockReset();
});

describe('Cobros — lista, resumen y filtros', () => {
  beforeEach(() => {
    mocks.turnos = [
      turno(1, { nombre: 'Camila', fecha: '2026-10-09 15:30:00', estado: 'confirmado', sena: { monto: 6000, estado: 'aprobado', reserva_web_id: 1 } }),
      turno(2, { nombre: 'Lucía', fecha: '2026-10-10 11:00:00', estado: 'confirmado' }),
      turno(3, { nombre: 'Paula', fecha: '2026-10-07 17:30:00', precio: '21000' }),
      turno(4, { nombre: 'Sofía', fecha: '2026-10-06 15:00:00' }),
    ];
  });

  it('muestra cliente, servicio, profesional y los dos pills de cada turno', () => {
    renderPage();
    const fila = screen.getByText('Camila Test').parentElement as HTMLElement;
    expect(within(fila).getByText(/Capping/)).toBeInTheDocument();
    expect(within(fila).getByText(/con Natalia/)).toBeInTheDocument();
    expect(within(fila).getByText('Confirmado')).toBeInTheDocument();
    expect(within(fila).getByText('Pagó solo seña')).toBeInTheDocument();
    const paula = screen.getByText('Paula Test').parentElement as HTMLElement;
    expect(within(paula).getByText('Finalizado')).toBeInTheDocument();
    expect(within(paula).getByText('Pagó todo')).toBeInTheDocument();
  });

  it('resume seña cobrada, cobrado en finalizados y falta cobrar', () => {
    renderPage();
    const tile = (label: string) => screen.getByText(label).parentElement as HTMLElement;
    expect(within(tile('Seña cobrada')).getByText('$6.000')).toBeInTheDocument();
    expect(within(tile('Cobrado en turnos finalizados')).getByText('$21.000')).toBeInTheDocument();
    // Camila 18000-6000 + Lucía 18000
    expect(within(tile('Falta cobrar')).getByText('$30.000')).toBeInTheDocument();
    expect(screen.getByText('1 turno sin precio cargado')).toBeInTheDocument();
  });

  it('combina los filtros de turno y pago, y el resumen sigue a la lista', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmados' }));
    fireEvent.click(screen.getByRole('button', { name: 'Solo seña' }));
    expect(screen.getByText('Camila Test')).toBeInTheDocument();
    expect(screen.queryByText('Lucía Test')).not.toBeInTheDocument();
    expect(screen.queryByText('Paula Test')).not.toBeInTheDocument();
    expect((screen.getByText('Falta cobrar').parentElement as HTMLElement).textContent).toContain('$12.000');
  });

  it('busca por nombre del cliente', () => {
    renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nombre del cliente' }), { target: { value: 'sofia' } });
    expect(screen.getByText('Sofía Test')).toBeInTheDocument();
    expect(screen.queryByText('Camila Test')).not.toBeInTheDocument();
  });

  it('entra con "Falta cargar el precio" elegido cuando viene de ?pago=sinprecio', () => {
    mocks.query = 'pago=sinprecio';
    renderPage();
    expect(screen.getByRole('button', { name: 'Falta cargar el precio' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Sofía Test')).toBeInTheDocument();
    expect(screen.queryByText('Paula Test')).not.toBeInTheDocument();
  });

  it('un valor desconocido en ?pago= cae en "Todos"', () => {
    mocks.query = 'pago=cualquiera';
    renderPage();
    const todos = screen.getAllByRole('button', { name: 'Todos' });
    expect(todos.every(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  it('con un turno sin `sena` (backend viejo) no se rompe', () => {
    mocks.turnos = [turno(1, { nombre: 'Camila', fecha: '2026-10-09 15:30:00', estado: 'confirmado' })];
    renderPage();
    const fila = screen.getByText('Camila Test').parentElement as HTMLElement;
    expect(within(fila).getByText('Sin pago')).toBeInTheDocument();
  });

  it('sin resultados avisa que no hay turnos con esos filtros', () => {
    mocks.turnos = [];
    renderPage();
    expect(screen.getByText('No hay turnos con esos filtros.')).toBeInTheDocument();
  });
});

describe('Cobros — usar precio de lista en todos', () => {
  beforeEach(() => {
    mocks.query = 'pago=sinprecio';
  });

  it('el botón explica para qué sirve', () => {
    renderPage();
    expect(screen.getByRole('button', { name: BOTON_TODOS })).toBeInTheDocument();
    expect(screen.getByText(/Para cuando cobraste lo habitual/)).toBeInTheDocument();
  });

  it('pide confirmación con la cantidad y el total, y si se cancela no guarda nada', async () => {
    mocks.confirmar.mockResolvedValue(false);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON_TODOS }));
    await waitFor(() => expect(mocks.confirmar).toHaveBeenCalledTimes(1));
    expect(mocks.confirmar.mock.calls[0][0]).toContain('3 turnos');
    expect(mocks.confirmar.mock.calls[0][0]).toContain('$54.000');
    expect(mocks.actualizar).not.toHaveBeenCalled();
  });

  it('al confirmar registra cada turno, avisa una sola vez y recarga la lista', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON_TODOS }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(3));
    expect(mocks.actualizar).toHaveBeenCalledWith(3, [{ servicio_id: 1, precio: 18000 }]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('3 turnos cobrados'));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.fetchCobros).toHaveBeenCalledTimes(2); // al montar + al terminar
  });

  it('si uno falla se corta y cuenta cuántos se alcanzaron a registrar', async () => {
    mocks.actualizar
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, message: 'Error de red' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON_TODOS }));
    await waitFor(() => expect(mocks.avisar).toHaveBeenCalledTimes(1));
    expect(mocks.actualizar).toHaveBeenCalledTimes(2);
    expect(mocks.avisar.mock.calls[0][0]).toContain('1 de 3');
    expect(mocks.avisar.mock.calls[0][0]).toContain('Error de red');
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('solo cuenta los turnos cuyos servicios tienen precio de lista', async () => {
    mocks.turnos = [
      turno(1, { nombre: 'Mica', fecha: '2026-09-10 10:00:00' }),
      turno(2, { nombre: 'Ana', fecha: '2026-09-12 11:00:00' }),
      turno(3, { nombre: 'Luz', fecha: '2026-09-14 12:00:00', servicioId: 2 }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Usar precio de lista en los 2 turnos/ }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(2));
    expect(mocks.actualizar.mock.calls.map(c => c[0]).sort()).toEqual([1, 2]);
  });

  it('con menos de dos turnos con precio de lista no aparece (cada fila ya tiene su botón)', () => {
    mocks.turnos = [
      turno(1, { nombre: 'Mica', fecha: '2026-09-10 10:00:00' }),
      turno(3, { nombre: 'Luz', fecha: '2026-09-14 12:00:00', servicioId: 2 }),
    ];
    renderPage();
    expect(screen.queryByRole('button', { name: /Usar precio de lista en los/ })).not.toBeInTheDocument();
  });
});
