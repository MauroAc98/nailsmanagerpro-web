import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen, within } from '@/test/render';
import { proService } from '@/services/proService';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import type { ProVinculo } from '@/lib/pro/tipos';
import { registrarResetPorNegocio, useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/negocios', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: nav.push }),
}));

import { ListaNegocios } from './ListaNegocios';

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

function cargar(vinculos: ProVinculo[], extra: Record<string, unknown> = {}) {
  useProAuthStore.setState({ status: 'full', email: 'ana@x.com', vinculos, vinculoActivoId: null, bloqueos: {}, ...extra });
}

beforeEach(() => {
  localStorage.clear();
  nav.push.mockClear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
});

describe('ListaNegocios', () => {
  it('lista cada negocio con la profesional (nombre y apellido) y un título', () => {
    cargar([vinculo(1), vinculo(2, { profesional: { nombre: 'Lía', apellido: null, avatar_url: null } })]);
    renderWithProviders(<ListaNegocios />);

    expect(screen.getByRole('heading', { name: 'Elegí un negocio' })).toBeInTheDocument();
    const fila1 = screen.getByRole('button', { name: /Negocio 1/ });
    expect(within(fila1).getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Negocio 2/ })).toHaveTextContent('Lía');
  });

  it('sin foto muestra las iniciales; con foto usa la imagen', () => {
    cargar([vinculo(1), vinculo(2, { profesional: { nombre: 'Lía', apellido: null, avatar_url: 'https://cdn.x/l.png' } })]);
    const { container } = renderWithProviders(<ListaNegocios />);

    expect(within(screen.getByRole('button', { name: /Negocio 1/ })).getByText('AP')).toBeInTheDocument();
    expect(container.querySelector('img[src="https://cdn.x/l.png"]')).not.toBeNull();
  });

  it('el foco va al título al montar', () => {
    cargar([vinculo(1), vinculo(2)]);
    renderWithProviders(<ListaNegocios />);
    expect(screen.getByRole('heading', { name: 'Elegí un negocio' })).toHaveFocus();
  });

  it('tocar un negocio disponible llama a elegirVinculo una sola vez y no navega', () => {
    const elegirVinculo = vi.fn();
    cargar([vinculo(1), vinculo(2)], { elegirVinculo });
    renderWithProviders(<ListaNegocios />);

    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));
    expect(elegirVinculo).toHaveBeenCalledTimes(1);
    expect(elegirVinculo).toHaveBeenCalledWith(2);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it.each([
    ['NO_SUBSCRIPTION', 'Este negocio todavía no tiene el servicio activo.'],
    ['SUBSCRIPTION_SUSPENDED', 'El servicio de este negocio está suspendido.'],
    ['SUBSCRIPTION_EXPIRED', 'El servicio de este negocio venció.'],
    [null, 'Este negocio no está disponible por ahora.'],
  ] as const)('un negocio no disponible (motivo %s) se ve deshabilitado con su copy', (motivo, copy) => {
    const elegirVinculo = vi.fn();
    cargar([vinculo(1), vinculo(2, { disponible: false, motivo })], { elegirVinculo });
    renderWithProviders(<ListaNegocios />);

    const fila = screen.getByRole('button', { name: /Negocio 2/ });
    expect(fila).toHaveAttribute('aria-disabled', 'true');
    expect(fila).toHaveTextContent(copy);
    fireEvent.click(fila);
    expect(elegirVinculo).not.toHaveBeenCalled();
  });

  it('un motivo desconocido cae al copy genérico', () => {
    cargar([vinculo(1), vinculo(2, { disponible: false, motivo: 'OTRO' as never })]);
    renderWithProviders(<ListaNegocios />);
    expect(screen.getByRole('button', { name: /Negocio 2/ })).toHaveTextContent('Este negocio no está disponible por ahora.');
  });

  it('un bloqueo detectado en tiempo de ejecución también deshabilita la fila', () => {
    const elegirVinculo = vi.fn();
    cargar([vinculo(1), vinculo(2)], {
      elegirVinculo,
      bloqueos: { 2: { estado: 'noService', motivo: 'SUBSCRIPTION_EXPIRED' } },
    });
    renderWithProviders(<ListaNegocios />);

    const fila = screen.getByRole('button', { name: /Negocio 2/ });
    expect(fila).toHaveAttribute('aria-disabled', 'true');
    expect(fila).toHaveTextContent('El servicio de este negocio venció.');
    fireEvent.click(fila);
    expect(elegirVinculo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Negocio 1/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('nombres largos: la fila cede (minWidth 0 + puntos suspensivos) y el chip no se encoge', () => {
    const largo = 'N'.repeat(120);
    cargar([vinculo(1, { negocioNombre: largo }), vinculo(2)]);
    renderWithProviders(<ListaNegocios />);

    const nombre = screen.getByText(largo);
    expect(nombre).toHaveStyle({ minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    expect(screen.getAllByText('Disponible')[0]).toHaveStyle({ flexShrink: '0' });
  });

  it('las filas son tocables (alto mínimo de 44 px)', () => {
    cargar([vinculo(1), vinculo(2)]);
    renderWithProviders(<ListaNegocios />);
    expect(screen.getByRole('button', { name: /Negocio 1/ })).toHaveStyle({ minHeight: '44px' });
  });

  describe('con el store real', () => {
    it('un id guardado que `me` ya no lista cae a la lista para elegir', async () => {
      localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '99');
      vi.spyOn(proService, 'me').mockResolvedValue({ email: 'ana@x.com', vinculos: [vinculo(1), vinculo(2)], descartados: 0 });
      useProAuthStore.setState({ status: 'loadingMe' });
      await act(async () => {
        await useProAuthStore.getState().cargarMe();
      });

      expect(useProAuthStore.getState().vinculoActivoId).toBeNull();
      renderWithProviders(<ListaNegocios />);
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('elegir otro negocio corre los resets registrados y guarda el último; el mismo no resetea', () => {
      const reset = vi.fn();
      const quitar = registrarResetPorNegocio(reset);
      cargar([vinculo(1), vinculo(2)]);
      renderWithProviders(<ListaNegocios />);

      fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));
      expect(reset).toHaveBeenCalledTimes(1);
      expect(useProAuthStore.getState().vinculoActivoId).toBe(2);
      expect(localStorage.getItem(PRO_STORAGE_KEYS.ultimoVinculo)).toBe('2');

      fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));
      expect(reset).toHaveBeenCalledTimes(1);
      quitar();
    });
  });
});
