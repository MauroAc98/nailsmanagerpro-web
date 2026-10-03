import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { es } from '@/messages';
import type { Turno } from '@/services/turnoService';

const mocks = vi.hoisted(() => ({
  pendientes: [] as unknown[],
  pedirPrecios: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock('@/components/BackButton', () => ({ default: () => null }));
vi.mock('@/store/usePendientesDeCobroStore', () => ({
  usePendientesDeCobroStore: () => ({
    loading: false, error: null, buscar: '', setBuscar: vi.fn(),
    fetchPendientes: vi.fn(), actualizarPrecios: vi.fn(),
  }),
  usePendientesFiltrados: () => mocks.pendientes,
}));
vi.mock('@/store/useServicioStore', () => ({
  useServiciosStore: () => ({ servicios: [{ id: 1, nombre: 'Capping', precio: '18000' }], fetchServicios: vi.fn() }),
}));
vi.mock('@/store/usePrecioServiciosStore', () => ({ pedirPreciosServicios: mocks.pedirPrecios }));
vi.mock('@/store/useToastStore', () => ({ showToast: vi.fn() }));
vi.mock('@/store/useConfirmStore', () => ({ alertDialog: vi.fn(), confirmDialog: vi.fn() }));

import PendientesDeCobroPage from './page';

const turno = (id: number, nombre: string, fecha: string) =>
  ({
    id, fecha_hora: fecha,
    cliente: { nombre, apellido: 'Test' },
    servicios: [{ id: 1, nombre: 'Capping' }],
  }) as unknown as Turno;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <PendientesDeCobroPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mocks.pendientes = [
    turno(1, 'Mica', '2026-09-10 10:00:00'),
    turno(2, 'Ana', '2026-09-12 11:00:00'),
    turno(3, 'Luz', '2026-09-14 12:00:00'),
  ];
  mocks.pedirPrecios.mockReset();
  mocks.pedirPrecios.mockResolvedValue(null);
});

describe('Pendientes de cobro — cargar de a uno', () => {
  it('el botón vive dentro de la tarjeta de resumen y dice qué hace', () => {
    renderPage();
    const boton = screen.getByRole('button', { name: /Cargar los 3 cobros, uno por uno/ });
    const tarjeta = screen.getByText('Sin registrar').parentElement as HTMLElement;
    expect(tarjeta.contains(boton)).toBe(true);
    expect(within(tarjeta).getByText('Se abre un turno por vez para anotar cuánto cobraste')).toBeInTheDocument();
  });

  it('no hay ningún botón fijo flotando sobre la pantalla', () => {
    const { container } = renderPage();
    expect(container.querySelector('[style*="position: fixed"]')).toBeNull();
  });

  it('al tocarlo abre el primer turno (el más antiguo) para cargar el cobro', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Cargar los 3 cobros, uno por uno/ }));
    expect(mocks.pedirPrecios).toHaveBeenCalledTimes(1);
    expect(mocks.pedirPrecios.mock.calls[0][1]).toMatchObject({ cliente: 'Mica Test', modo: 'cargar' });
  });

  it('con un solo turno pendiente no aparece (la propia tarjeta ya tiene "Cargar")', () => {
    mocks.pendientes = [turno(1, 'Mica', '2026-09-10 10:00:00')];
    renderPage();
    expect(screen.queryByRole('button', { name: /uno por uno/ })).not.toBeInTheDocument();
  });
});
