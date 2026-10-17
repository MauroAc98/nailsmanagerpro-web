import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen } from '@/test/render';
import { resetNavigationMock, routerMock, setMockLocation } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import { useLocaleStore } from '@/store/useLocaleStore';
import { useProAuthStore } from '@/store/useProAuthStore';
import ProLayout, * as modulo from './layout';
import * as paginaRaiz from './page';
import PaginaRaiz from './page';
import PaginaNoDisponible from './no-disponible/page';
import * as paginaNoDisponible from './no-disponible/page';

beforeEach(() => {
  resetNavigationMock();
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  useLocaleStore.setState({ mensajesListos: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('layout del portal — metadata (SH-2 S1)', () => {
  it('declara su propio manifest, título y descripción', () => {
    expect(modulo.metadata.manifest).toBe('/pro-manifest.json');
    expect(modulo.metadata.title).toBe('Turnetto Profesionales');
    expect(modulo.metadata.description).toEqual(expect.any(String));
    expect(modulo.metadata.description).not.toBe('');
  });

  it('repite el appleWebApp completo: Next mezcla la metadata de forma superficial y la clave del layout raíz se reemplaza entera', () => {
    expect(modulo.metadata.appleWebApp).toEqual({ capable: true, statusBarStyle: 'default', title: 'Turnetto Pro' });
  });

  it('no hereda el manifest ni el título del salón', () => {
    expect(modulo.metadata.manifest).not.toBe('/manifest.json');
    expect(modulo.metadata.title).not.toBe('Turnetto');
  });

  it('solo exporta lo que Next permite en un layout (default y metadata)', () => {
    expect(Object.keys(modulo).sort()).toEqual(['default', 'metadata']);
  });
});

describe('layout del portal — guard y tema', () => {
  it('es un Server Component: no declara "use client" (si no, no podría exportar metadata)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const fuente = readFileSync(resolve(__dirname, 'layout.tsx'), 'utf8');
    expect(fuente).not.toMatch(/^\s*['"]use client['"]/m);
  });

  it('muestra los hijos dentro del tema de agenda cuando la ruta está permitida', async () => {
    setMockLocation('/login');

    renderWithProviders(
      <ProLayout>
        <div>PANTALLA DE INGRESO</div>
      </ProLayout>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const hijo = screen.getByText('PANTALLA DE INGRESO');
    expect(hijo.closest('.agenda-light, .agenda-dark')).not.toBeNull();
  });

  it('no muestra los hijos si la ruta no está permitida: redirige', async () => {
    setMockLocation('/agenda');

    renderWithProviders(
      <ProLayout>
        <div>AGENDA</div>
      </ProLayout>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('AGENDA')).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith('/login');
  });

  it('el Spinner mientras decide también queda dentro del tema de agenda', async () => {
    useLocaleStore.setState({ mensajesListos: false });
    setMockLocation('/agenda');

    renderWithProviders(
      <ProLayout>
        <div>AGENDA</div>
      </ProLayout>,
    );

    const spinner = screen.getByRole('status', { name: 'Un momento' });
    expect(spinner.closest('.agenda-light, .agenda-dark')).not.toBeNull();
  });
});

describe('páginas del portal', () => {
  it('la raíz no renderiza nada: el guard decide a dónde ir', () => {
    const { container } = renderWithProviders(<PaginaRaiz />);
    expect(container).toBeEmptyDOMElement();
  });

  it('la raíz y /no-disponible solo exportan lo que Next permite en una página (default)', () => {
    expect(Object.keys(paginaRaiz)).toEqual(['default']);
    expect(Object.keys(paginaNoDisponible)).toEqual(['default']);
  });

  it('/no-disponible muestra la pantalla de portal no disponible', () => {
    renderWithProviders(<PaginaNoDisponible />);
    expect(screen.getByRole('heading', { name: 'El portal no está disponible' })).toBeInTheDocument();
  });
});
