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

const turno = (id: number, nombre: string, apellido: string, servicios: string[], fecha_hora = '2025-01-05 15:00:00') =>
  ({
    id, fecha_hora, grupo_id: null,
    cliente: { nombre, apellido },
    servicios: servicios.map((n, i) => ({ id: i + 1, nombre: n })),
  }) as unknown as Turno;

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
  it('con una visita: arriba a quién, abajo qué y cuándo', () => {
    mockStore.state.pendientes = [turno(1, 'Mica', 'Bochetti', ['Capping'])];
    renderBanner();
    expect(screen.getByText('Por cobrar · Mica Bochetti')).toBeInTheDocument();
    expect(screen.getByText('Capping · 5/1 15:00')).toBeInTheDocument();
  });

  it('con varias visitas: cuántas arriba y los nombres cortos abajo', () => {
    mockStore.state.pendientes = [
      turno(1, 'Cristina', 'Fernández', ['Capping']),
      turno(2, 'Ana', 'Gómez', ['Soft gel']),
      turno(3, 'Mica', 'Bochetti', ['Esmaltado']),
    ];
    renderBanner();
    expect(screen.getByText('3 visitas por cobrar')).toBeInTheDocument();
    expect(screen.getByText('Cristina F., Ana G. y 1 más')).toBeInTheDocument();
  });

  it('con dos visitas de clientes distintos nombra a las dos', () => {
    mockStore.state.pendientes = [turno(1, 'Cristina', 'Fernández', ['Capping']), turno(2, 'Ana', 'Gómez', ['Soft gel'])];
    renderBanner();
    expect(screen.getByText('Cristina F. y Ana G.')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /por cobrar/i }));
    expect(mockStore.push).toHaveBeenCalledWith('/configuracion/cobros?pago=sinprecio');
  });

  it('sin pendientes ni error no se muestra', () => {
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });
});
