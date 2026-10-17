import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/agenda' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ProHeader } from './ProHeader';

function vinculo(id: number): ProVinculo {
  return {
    id,
    negocioNombre: `Negocio ${id}`,
    profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: null },
    disponible: true,
    motivo: null,
  };
}

function cargar(vinculos: ProVinculo[], activo: number | null) {
  useProAuthStore.setState({ status: 'full', vinculos, vinculoActivoId: activo, bloqueos: {} });
}

beforeEach(() => {
  nav.pathname = '/agenda';
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
});

describe('ProHeader', () => {
  it('con un solo negocio muestra el nombre como texto, sin botón', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<ProHeader />);

    expect(screen.getByText('Negocio 1')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('con más de un negocio el nombre es un botón con flecha que abre el selector', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    const { container } = renderWithProviders(<ProHeader />);

    const boton = screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 1' });
    expect(boton).toHaveAttribute('aria-haspopup', 'dialog');
    expect(boton).toHaveTextContent('Negocio 1');
    expect(container.querySelector('button svg')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(boton);
    expect(screen.getByRole('dialog', { name: 'Cambiar de negocio' })).toBeInTheDocument();
  });

  it('elegir otro negocio cambia el nombre, cierra el selector y devuelve el foco al botón', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));

    expect(screen.queryByRole('dialog')).toBeNull();
    const boton = screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 2' });
    expect(boton).toHaveFocus();
  });

  it('cerrar el selector devuelve el foco al botón', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    const boton = screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 1' });
    fireEvent.click(boton);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boton).toHaveFocus();
  });

  it('el botón y el enlace de cuenta son tocables y el nombre largo se corta', () => {
    const largo = 'N'.repeat(120);
    cargar([{ ...vinculo(1), negocioNombre: largo }, vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    expect(screen.getByText(largo)).toHaveStyle({ minWidth: '0', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    expect(screen.getByRole('button', { name: /Cambiar de negocio/ })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveStyle({ minHeight: '44px', flexShrink: '0' });
  });

  it('el enlace de cuenta va a /cuenta, con prefijo /pro en localhost', () => {
    cargar([vinculo(1)], 1);
    const { unmount } = renderWithProviders(<ProHeader />);
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/cuenta');
    unmount();

    nav.pathname = '/pro/agenda';
    renderWithProviders(<ProHeader />);
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/pro/cuenta');
  });

  it('sin negocio activo no muestra nombre ni botón, pero deja la cuenta', () => {
    cargar([vinculo(1), vinculo(2)], null);
    renderWithProviders(<ProHeader />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
  });
});
