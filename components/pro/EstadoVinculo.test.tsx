import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { proService } from '@/services/proService';
import { calcularAcceso } from '@/lib/pro/acceso';
import type { ProVinculo } from '@/lib/pro/tipos';
import { useProAuthStore } from '@/store/useProAuthStore';

const nav = vi.hoisted(() => ({ pathname: '/sin-servicio' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { EstadoVinculo } from './EstadoVinculo';

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

const vencido = (id: number) => vinculo(id, { disponible: false, motivo: 'SUBSCRIPTION_EXPIRED' });

function cargar(vinculos: ProVinculo[], activo: number | null, bloqueos = {}) {
  useProAuthStore.setState({ status: 'full', token: 'tok', vinculos, vinculoActivoId: activo, bloqueos });
}

beforeEach(() => {
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  vi.restoreAllMocks();
});

describe('EstadoVinculo — acceso deshabilitado', () => {
  it('pide contactar a la persona titular, ofrece cerrar sesión y no pide datos', () => {
    const turnos = vi.spyOn(proService, 'turnos');
    const marcas = vi.spyOn(proService, 'marcas');
    cargar([vinculo(1)], 1, { 1: { estado: 'disabled', motivo: null } });
    renderWithProviders(<EstadoVinculo variante="deshabilitado" />);

    expect(screen.getByRole('heading', { name: 'Tu acceso está deshabilitado' })).toBeInTheDocument();
    expect(screen.getByText(/Contactá a la persona titular del negocio/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveStyle({ minHeight: '44px' });
    expect(turnos).not.toHaveBeenCalled();
    expect(marcas).not.toHaveBeenCalled();
  });

  it('sin vínculos (acceso quitado) es la pantalla de acceso deshabilitado', () => {
    cargar([], null);
    expect(calcularAcceso([], null, {})).toBe('deshabilitado');
    renderWithProviders(<EstadoVinculo variante="deshabilitado" />);
    expect(screen.getByRole('heading', { name: 'Tu acceso está deshabilitado' })).toBeInTheDocument();
  });

  it('solo expone el nombre del negocio, sin datos de agenda ni de otras personas', () => {
    cargar([vinculo(1)], 1, { 1: { estado: 'disabled', motivo: null } });
    renderWithProviders(<EstadoVinculo variante="deshabilitado" />);

    expect(screen.getByText('Negocio 1')).toBeInTheDocument();
    expect(screen.queryByText(/Pérez/)).toBeNull();
  });

  it('cerrar sesión llama al store una sola vez aunque se toque dos veces', async () => {
    const logout = vi.spyOn(proService, 'logout').mockResolvedValue(undefined as never);
    cargar([vinculo(1)], 1, { 1: { estado: 'disabled', motivo: null } });
    renderWithProviders(<EstadoVinculo variante="deshabilitado" />);

    const boton = screen.getByRole('button', { name: 'Cerrar sesión' });
    fireEvent.click(boton);
    fireEvent.click(boton);
    await vi.waitFor(() => expect(useProAuthStore.getState().status).toBe('anonymous'));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});

describe('EstadoVinculo — sin servicio', () => {
  it('explica el motivo de la suscripción vencida y ofrece cerrar sesión', () => {
    cargar([vencido(1)], 1);
    renderWithProviders(<EstadoVinculo variante="sinServicio" />);

    expect(screen.getByRole('heading', { name: 'Tu negocio no tiene servicio' })).toBeInTheDocument();
    expect(screen.getByText('El servicio de este negocio venció.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('el motivo detectado en una llamada de datos gana sobre el de `me`', () => {
    cargar([vencido(1)], 1, { 1: { estado: 'noService', motivo: 'SUBSCRIPTION_SUSPENDED' } });
    renderWithProviders(<EstadoVinculo variante="sinServicio" />);
    expect(screen.getByText('El servicio de este negocio está suspendido.')).toBeInTheDocument();
  });

  it('un motivo desconocido cae en el texto genérico', () => {
    cargar([vinculo(1, { disponible: false, motivo: null })], 1);
    renderWithProviders(<EstadoVinculo variante="sinServicio" />);
    expect(screen.getByText('Este negocio no está disponible por ahora.')).toBeInTheDocument();
  });

  it('con todos los negocios sin servicio no ofrece cambiar de negocio', () => {
    cargar([vencido(1), vencido(2)], null);
    expect(calcularAcceso([vencido(1), vencido(2)], null, {})).toBe('sinServicio');
    renderWithProviders(<EstadoVinculo variante="sinServicio" />);

    expect(screen.queryByRole('button', { name: 'Cambiar de negocio' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('con otro negocio usable ofrece cambiar y elegirlo lo activa', () => {
    cargar([vencido(1), vinculo(2)], 1);
    renderWithProviders(<EstadoVinculo variante="sinServicio" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de negocio' }));
    fireEvent.click(screen.getByRole('button', { name: /Negocio 2/ }));

    expect(useProAuthStore.getState().vinculoActivoId).toBe(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('los botones son tocables (44 px)', () => {
    cargar([vencido(1), vinculo(2)], 1);
    renderWithProviders(<EstadoVinculo variante="sinServicio" />);
    expect(screen.getByRole('button', { name: 'Cambiar de negocio' })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveStyle({ minHeight: '44px' });
  });
});
