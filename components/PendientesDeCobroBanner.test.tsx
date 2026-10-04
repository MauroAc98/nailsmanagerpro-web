import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { Turno } from '@/services/turnoService';

const mockStore = vi.hoisted(() => ({
  push: vi.fn(),
  state: { pendientes: [] as unknown[], error: null as string | null, fetchPendientes: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockStore.push }) }));
vi.mock('@/store/usePendientesDeCobroStore', () => ({
  usePendientesDeCobroStore: () => mockStore.state,
}));

import { PendientesDeCobroBanner } from './PendientesDeCobroBanner';

const turno = (id: number, nombre: string, apellido: string, servicios: string[]) =>
  ({ id, cliente: { nombre, apellido }, servicios: servicios.map((n, i) => ({ id: i + 1, nombre: n })) }) as unknown as Turno;

function renderBanner() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <PendientesDeCobroBanner />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mockStore.state = { pendientes: [], error: null, fetchPendientes: vi.fn() };
});

describe('PendientesDeCobroBanner — dice lo que falta', () => {
  it('con un turno: título "Cobros por registrar" y a quién y por qué servicio falta cargar lo cobrado', () => {
    mockStore.state.pendientes = [turno(1, 'Mica', 'Bochetti', ['Capping'])];
    renderBanner();
    expect(screen.getByText('Cobros por registrar')).toBeInTheDocument();
    expect(screen.getByText('Falta cargar cuánto cobraste a Mica Bochetti por Capping')).toBeInTheDocument();
  });

  it('con varios turnos: la cantidad de turnos finalizados', () => {
    mockStore.state.pendientes = [turno(1, 'Mica', 'Bochetti', ['Capping']), turno(2, 'Ana', 'Perez', ['Soft gel'])];
    renderBanner();
    expect(screen.getByText('Falta cargar lo cobrado en 2 turnos finalizados')).toBeInTheDocument();
  });

  it('ya no habla de "precios por cargar" ni de "sin precio cargado"', () => {
    mockStore.state.pendientes = [turno(1, 'Mica', 'Bochetti', ['Capping'])];
    renderBanner();
    expect(screen.queryByText(/Precios por cargar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin precio cargado/i)).not.toBeInTheDocument();
  });

  it('al tocarlo abre Cobros con el filtro "falta cargar el precio" ya elegido', () => {
    mockStore.state.pendientes = [turno(1, 'Mica', 'Bochetti', ['Capping'])];
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /Cobros por registrar/ }));
    expect(mockStore.push).toHaveBeenCalledWith('/configuracion/cobros?pago=sinprecio');
  });

  it('sin pendientes ni error no se muestra', () => {
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });
});
