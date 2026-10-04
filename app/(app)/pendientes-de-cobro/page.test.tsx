import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { Turno } from '@/services/turnoService';

const mocks = vi.hoisted(() => ({
  pendientes: [] as unknown[],
  actualizar: vi.fn(),
  confirmar: vi.fn(),
  avisar: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock('@/components/BackButton', () => ({ default: () => null }));
vi.mock('@/store/usePendientesDeCobroStore', () => ({
  usePendientesDeCobroStore: () => ({
    loading: false, error: null, buscar: '', setBuscar: vi.fn(),
    fetchPendientes: vi.fn(), actualizarPrecios: mocks.actualizar,
  }),
  usePendientesFiltrados: () => mocks.pendientes,
}));
// Servicio 1 tiene precio de lista ($18.000); el 2 no.
vi.mock('@/store/useServicioStore', () => ({
  useServiciosStore: () => ({
    servicios: [{ id: 1, nombre: 'Capping', precio: '18000' }, { id: 2, nombre: 'Soft gel', precio: null }],
    fetchServicios: vi.fn(),
  }),
}));
vi.mock('@/store/usePrecioServiciosStore', () => ({ pedirPreciosServicios: vi.fn() }));
vi.mock('@/store/useToastStore', () => ({ showToast: mocks.toast }));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: mocks.avisar, confirmDialog: mocks.confirmar }));

import PendientesDeCobroPage from './page';

const turno = (id: number, nombre: string, fecha: string, servicioId = 1) =>
  ({
    id, fecha_hora: fecha,
    cliente: { nombre, apellido: 'Test' },
    servicios: [{ id: servicioId, nombre: servicioId === 1 ? 'Capping' : 'Soft gel' }],
  }) as unknown as Turno;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <PendientesDeCobroPage />
    </NextIntlClientProvider>,
  );
}

const BOTON_TODOS = /Usar precio de lista en los 3 turnos/;

beforeEach(() => {
  mocks.pendientes = [
    turno(1, 'Mica', '2026-09-10 10:00:00'),
    turno(2, 'Ana', '2026-09-12 11:00:00'),
    turno(3, 'Luz', '2026-09-14 12:00:00'),
  ];
  mocks.actualizar.mockReset();
  mocks.actualizar.mockResolvedValue({ success: true });
  mocks.confirmar.mockReset();
  mocks.confirmar.mockResolvedValue(true);
  mocks.avisar.mockReset();
  mocks.toast.mockReset();
});

describe('Pendientes de cobro — usar precio de lista en todos', () => {
  it('el botón vive dentro de la tarjeta de resumen y explica para qué sirve', () => {
    renderPage();
    const boton = screen.getByRole('button', { name: BOTON_TODOS });
    const tarjeta = screen.getByText('Sin registrar').parentElement as HTMLElement;
    expect(tarjeta.contains(boton)).toBe(true);
    expect(within(tarjeta).getByText(/Para cuando cobraste lo habitual/)).toBeInTheDocument();
  });

  it('ya no existe el "uno por uno" ni hay un botón fijo flotando', () => {
    const { container } = renderPage();
    expect(screen.queryByText(/uno por uno/)).not.toBeInTheDocument();
    expect(container.querySelector('[style*="position: fixed"]')).toBeNull();
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

  it('al confirmar registra cada turno a precio de lista y avisa una sola vez', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: BOTON_TODOS }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(3));
    expect(mocks.actualizar.mock.calls.map(c => c[0])).toEqual([1, 2, 3]);
    expect(mocks.actualizar).toHaveBeenCalledWith(1, [{ servicio_id: 1, precio: 18000 }]);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledWith('3 turnos registrados');
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

  it('solo cuenta (y registra) los turnos cuyos servicios tienen precio de lista', async () => {
    mocks.pendientes = [
      turno(1, 'Mica', '2026-09-10 10:00:00'),
      turno(2, 'Ana', '2026-09-12 11:00:00'),
      turno(3, 'Luz', '2026-09-14 12:00:00', 2), // Soft gel: sin precio de lista
    ];
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Usar precio de lista en los 2 turnos/ }));
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(2));
    expect(mocks.actualizar.mock.calls.map(c => c[0])).toEqual([1, 2]);
  });

  it('con menos de dos turnos con precio de lista no aparece (cada tarjeta ya tiene su botón)', () => {
    mocks.pendientes = [
      turno(1, 'Mica', '2026-09-10 10:00:00'),
      turno(3, 'Luz', '2026-09-14 12:00:00', 2),
    ];
    renderPage();
    expect(screen.queryByRole('button', { name: /Usar precio de lista en los/ })).not.toBeInTheDocument();
  });
});
