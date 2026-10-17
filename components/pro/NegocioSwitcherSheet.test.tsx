import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/render';
import type { ProVinculo } from '@/lib/pro/tipos';
import { registrarResetPorNegocio, useProAuthStore } from '@/store/useProAuthStore';

vi.mock('next/navigation', () => ({
  usePathname: () => '/agenda',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { NegocioSwitcherSheet } from './NegocioSwitcherSheet';

function vinculo(id: number, extra: Partial<ProVinculo> = {}): ProVinculo {
  return {
    id,
    negocioNombre: `Negocio ${id}`,
    profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
    disponible: true,
    motivo: null,
    ...extra,
  };
}

function cargar(vinculos: ProVinculo[], activo: number | null, extra: Record<string, unknown> = {}) {
  useProAuthStore.setState({ status: 'full', vinculos, vinculoActivoId: activo, bloqueos: {}, ...extra });
}

beforeEach(() => {
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
});

describe('NegocioSwitcherSheet', () => {
  it('cerrado no renderiza nada', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<NegocioSwitcherSheet abierto={false} onCerrar={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abierto lista los negocios en un diálogo con nombre y marca el actual', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={vi.fn()} />);

    const dialogo = screen.getByRole('dialog', { name: 'Cambiar de negocio' });
    const actual = within(dialogo).getByRole('button', { name: /Negocio 1/ });
    expect(actual).toHaveAttribute('aria-current', 'true');
    expect(actual).toHaveTextContent('Actual');
    expect(within(dialogo).getByRole('button', { name: /Negocio 2/ })).not.toHaveAttribute('aria-current');
  });

  it('elegir otro negocio llama a elegirVinculo y cierra', () => {
    const elegirVinculo = vi.fn();
    const onCerrar = vi.fn();
    cargar([vinculo(1), vinculo(2)], 1, { elegirVinculo });
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={onCerrar} />);

    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));
    expect(elegirVinculo).toHaveBeenCalledTimes(1);
    expect(elegirVinculo).toHaveBeenCalledWith(2);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('un negocio no disponible va deshabilitado y no cierra ni elige', () => {
    const elegirVinculo = vi.fn();
    const onCerrar = vi.fn();
    cargar([vinculo(1), vinculo(2, { disponible: false, motivo: 'SUBSCRIPTION_SUSPENDED' })], 1, { elegirVinculo });
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={onCerrar} />);

    const fila = screen.getByRole('button', { name: /Negocio 2/ });
    expect(fila).toHaveAttribute('aria-disabled', 'true');
    expect(fila).toHaveTextContent('El servicio de este negocio está suspendido.');
    fireEvent.click(fila);
    expect(elegirVinculo).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('cambiar de negocio corre los resets registrados (store real)', () => {
    const reset = vi.fn();
    const quitar = registrarResetPorNegocio(reset);
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(useProAuthStore.getState().vinculoActivoId).toBe(2);
    quitar();
  });

  it('se cierra con el botón Cerrar, con Escape y tocando el fondo', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    const onCerrar = vi.fn();
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={onCerrar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('fondo-selector'));
    expect(onCerrar).toHaveBeenCalledTimes(3);
  });

  it('al abrir el foco entra al título del diálogo', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Cambiar de negocio' })).toHaveFocus();
  });

  it('nombres largos: la fila cede con puntos suspensivos', () => {
    const largo = 'N'.repeat(120);
    cargar([vinculo(1, { negocioNombre: largo }), vinculo(2)], 2);
    renderWithProviders(<NegocioSwitcherSheet abierto onCerrar={vi.fn()} />);
    expect(screen.getByText(largo)).toHaveStyle({ minWidth: '0', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  });
});
