import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';
import { useThemeStore } from '@/store/useThemeStore';

vi.mock('next/navigation', () => ({
  usePathname: () => '/agenda',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ProHeader } from './ProHeader';

function vinculo(id: number, avatar: string | null = null): ProVinculo {
  return {
    id,
    negocioNombre: `Negocio ${id}`,
    profesional: { nombre: 'Ana', apellido: 'Pérez', avatar_url: avatar },
    disponible: true,
    motivo: null,
  };
}

function cargar(vinculos: ProVinculo[], activo: number | null) {
  useProAuthStore.setState({ status: 'full', vinculos, vinculoActivoId: activo, bloqueos: {} });
}

beforeEach(() => {
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  useThemeStore.setState({ theme: 'light', resolvedTheme: 'light' });
});

describe('ProHeader', () => {
  it('saluda con el nombre de la profesional (sin apellido) y muestra el logo decorativo si no tiene foto', () => {
    cargar([vinculo(1)], 1);
    const { container } = renderWithProviders(<ProHeader />);

    expect(screen.getByText('Hola, Ana')).toBeInTheDocument();
    expect(screen.queryByText(/Pérez/)).toBeNull();
    const logo = container.querySelector('img[src*="pro-logo"]');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveAttribute('width', '40');
  });

  it('el visual y el saludo arrancan alineados con el resto de la pantalla (mismo margen de 20 px, sin sangría)', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<ProHeader />);

    const cabecera = screen.getByRole('banner');
    expect(cabecera).toHaveStyle({ paddingLeft: '20px' });
    expect(screen.getByText('Hola, Ana').parentElement?.style.marginLeft).toBe('');
  });

  it('con foto muestra la foto de la profesional y NO el logo', () => {
    cargar([vinculo(1, 'https://cdn.test/ana.jpg')], 1);
    const { container } = renderWithProviders(<ProHeader />);

    expect(container.querySelector('img[src="https://cdn.test/ana.jpg"]')).not.toBeNull();
    expect(container.querySelector('img[src*="pro-logo"]')).toBeNull();
  });

  it('sin negocio activo muestra el logo con la marca en vez del saludo', () => {
    cargar([vinculo(1), vinculo(2)], null);
    const { container } = renderWithProviders(<ProHeader />);

    expect(screen.getByText('Turnetto')).toBeInTheDocument();
    expect(screen.queryByText(/Hola/)).toBeNull();
    expect(container.querySelector('img[src*="pro-logo"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Cambiar de negocio/ })).toBeNull();
  });

  it('el saludo largo se corta con puntos suspensivos', () => {
    const largo = 'N'.repeat(120);
    cargar([{ ...vinculo(1), profesional: { nombre: largo, apellido: null, avatar_url: null } }], 1);
    renderWithProviders(<ProHeader />);

    expect(screen.getByText(`Hola, ${largo}`)).toHaveStyle({ minWidth: '0', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  });

  it('ya no lleva el enlace a la cuenta (la navegación inferior lo cubre)', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<ProHeader />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('con un solo negocio no dibuja la fila Negocio ni el nombre del negocio', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<ProHeader />);

    expect(screen.queryByText('Negocio 1')).toBeNull();
    expect(screen.queryByRole('button', { name: /Cambiar de negocio/ })).toBeNull();
  });

  it('con más de un negocio dibuja la fila Negocio con el nombre actual y abre el selector', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    const fila = screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 1' });
    expect(fila).toHaveAttribute('aria-haspopup', 'dialog');
    expect(fila).toHaveTextContent('Negocio');
    expect(fila).toHaveTextContent('Negocio 1');
    expect(fila).toHaveStyle({ height: '56px' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(fila);
    expect(screen.getByRole('dialog', { name: 'Cambiar de negocio' })).toBeInTheDocument();
  });

  it('el nombre largo del negocio se corta dentro de la fila', () => {
    const largo = 'N'.repeat(120);
    cargar([{ ...vinculo(1), negocioNombre: largo }, vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    expect(screen.getByText(largo)).toHaveStyle({ minWidth: '0', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  });

  it('elegir otro negocio cierra el selector y devuelve el foco a la fila', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 2' })).toHaveFocus();
  });

  it('cerrar el selector devuelve el foco a la fila', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<ProHeader />);

    const fila = screen.getByRole('button', { name: 'Cambiar de negocio. Ahora: Negocio 1' });
    fireEvent.click(fila);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fila).toHaveFocus();
  });

  it('el botón de tema es un círculo de 40 px que alterna entre claro y oscuro', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<ProHeader />);

    const boton = screen.getByRole('button', { name: 'Cambiar a modo oscuro' });
    expect(boton).toHaveStyle({ width: '40px', height: '40px', flexShrink: '0' });
    fireEvent.click(boton);
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }));
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
  });
});
