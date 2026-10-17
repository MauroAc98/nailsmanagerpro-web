import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { proService } from '@/services/proService';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import { calcularAcceso } from '@/lib/pro/acceso';
import { resolveProRoute } from '@/lib/pro/resolveProRoute';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/cuenta' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { CuentaPro } from './CuentaPro';

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

function cargar(vinculos: ProVinculo[], activo: number | null) {
  proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: Date.now() + 60_000 });
  useProAuthStore.setState({
    status: 'full',
    token: 'tok',
    email: 'ana@correo.com',
    vinculos,
    vinculoActivoId: activo,
    bloqueos: {},
  });
}

beforeEach(() => {
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  vi.restoreAllMocks();
});

describe('CuentaPro', () => {
  it('muestra correo, negocio y nombre completo de la profesional con sus iniciales', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<CuentaPro />);

    expect(screen.getByRole('heading', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByText('ana@correo.com')).toBeInTheDocument();
    expect(screen.getByText('Negocio 1')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('AP')).toBeInTheDocument();
  });

  it('no muestra precios, comisiones ni ajustes de notificaciones', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<CuentaPro />);

    expect(screen.queryByText(/precio|comisi|notificaci/i)).toBeNull();
  });

  it('con un solo negocio no ofrece cambiar de negocio', () => {
    cargar([vinculo(1)], 1);
    renderWithProviders(<CuentaPro />);
    expect(screen.queryByRole('button', { name: 'Cambiar de negocio' })).toBeNull();
  });

  it('con más de un negocio ofrece cambiar y elegir otro lo activa', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<CuentaPro />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de negocio' }));
    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));

    expect(useProAuthStore.getState().vinculoActivoId).toBe(2);
    expect(screen.getByText('Negocio 2')).toBeInTheDocument();
  });

  it('cerrar sesión con doble toque hace un solo POST y limpia todo', async () => {
    const logout = vi.spyOn(proService, 'logout').mockResolvedValue(undefined as never);
    cargar([vinculo(1)], 1);
    renderWithProviders(<CuentaPro />);

    const boton = screen.getByRole('button', { name: 'Cerrar sesión' });
    fireEvent.click(boton);
    fireEvent.click(boton);
    await vi.waitFor(() => expect(useProAuthStore.getState().status).toBe('anonymous'));

    expect(logout).toHaveBeenCalledTimes(1);
    const s = useProAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.vinculos).toEqual([]);
    expect(s.email).toBeNull();
    expect(localStorage.getItem(PRO_STORAGE_KEYS.token)).toBeNull();
  });

  it('tras cerrar sesión, "atrás" cae en el ingreso: el guard no deja ver /cuenta', async () => {
    vi.spyOn(proService, 'logout').mockResolvedValue(undefined as never);
    cargar([vinculo(1)], 1);
    expect(resolveProRoute({ status: 'full', acceso: calcularAcceso([vinculo(1)], 1, {}) }, '/cuenta')).toEqual({ type: 'allow' });
    renderWithProviders(<CuentaPro />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await vi.waitFor(() => expect(useProAuthStore.getState().status).toBe('anonymous'));

    const s = useProAuthStore.getState();
    expect(resolveProRoute({ status: s.status, acceso: calcularAcceso(s.vinculos, s.vinculoActivoId, s.bloqueos) }, '/cuenta')).toEqual({
      type: 'redirect',
      to: '/login',
    });
  });

  it('los botones son tocables (44 px)', () => {
    cargar([vinculo(1), vinculo(2)], 1);
    renderWithProviders(<CuentaPro />);
    expect(screen.getByRole('button', { name: 'Cambiar de negocio' })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveStyle({ minHeight: '44px' });
  });

  it('un nombre de negocio largo se corta con puntos suspensivos', () => {
    const largo = 'N'.repeat(120);
    cargar([vinculo(1, { negocioNombre: largo })], 1);
    renderWithProviders(<CuentaPro />);
    expect(screen.getByText(largo)).toHaveStyle({ minWidth: '0', textOverflow: 'ellipsis' });
  });
});
