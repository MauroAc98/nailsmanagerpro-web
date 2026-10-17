import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithProviders, screen } from '@/test/render';
import { proService } from '@/services/proService';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import { useProAuthStore } from '@/store/useProAuthStore';
import { PortalNoDisponible } from './PortalNoDisponible';

beforeEach(() => {
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  useProAuthStore.setState({ status: 'portalUnavailable' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PortalNoDisponible', () => {
  it('explica que el portal no está disponible y ofrece reintentar', () => {
    renderWithProviders(<PortalNoDisponible />);

    expect(screen.getByRole('heading', { name: 'El portal no está disponible' })).toBeInTheDocument();
    expect(screen.getByText(/Probá de nuevo en unos minutos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('el botón de reintentar es tocable (alto mínimo de 44 px)', () => {
    renderWithProviders(<PortalNoDisponible />);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveStyle({ minHeight: '44px' });
  });

  it('reintentar sin sesión guardada vuelve al estado anónimo', () => {
    renderWithProviders(<PortalNoDisponible />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(useProAuthStore.getState().status).toBe('anonymous');
  });

  it('reintentar con una sesión guardada vuelve a pedir `me` y NO cierra la sesión', async () => {
    proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: Date.now() + 60_000 });
    const me = vi.spyOn(proService, 'me').mockResolvedValue({ email: 'a@b.c', vinculos: [], descartados: 0 });
    renderWithProviders(<PortalNoDisponible />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    });

    expect(me).toHaveBeenCalledTimes(1);
    expect(useProAuthStore.getState().status).toBe('full');
    expect(localStorage.getItem(PRO_STORAGE_KEYS.token)).toBe('tok');
  });
});

describe('PortalNoDisponible — reintento no cierra sesión', () => {
  it('reintentar llama a inicializar y nunca a logout', async () => {
    useProAuthStore.setState({ token: 'tok' });
    const logout = vi.spyOn(proService, 'logout');
    const inicializar = vi.spyOn(useProAuthStore.getState(), 'inicializar').mockResolvedValue(undefined as never);
    renderWithProviders(<PortalNoDisponible />);

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(inicializar).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
  });

  it('el contenido va en un <main> con título y no muestra datos del negocio', () => {
    useProAuthStore.setState({ token: 'tok', vinculos: [{ id: 1, negocioNombre: 'Secreto', profesional: { nombre: 'A', apellido: 'B', avatar_url: null }, disponible: true, motivo: null }] });
    renderWithProviders(<PortalNoDisponible />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryByText('Secreto')).toBeNull();
  });
});

describe('PortalNoDisponible — salida con sesión guardada', () => {
  it('sin sesión no ofrece cerrar sesión', () => {
    renderWithProviders(<PortalNoDisponible />);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });

  it('con un token guardado ofrece "Cerrar sesión" como acción secundaria', () => {
    useProAuthStore.setState({ token: 'tok' });
    renderWithProviders(<PortalNoDisponible />);

    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('cerrar sesión limpia la sesión y vuelve al estado anónimo aunque `me` siga fallando', async () => {
    proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: Date.now() + 60_000 });
    vi.spyOn(proService, 'logout').mockRejectedValue(new Error('sin red'));
    useProAuthStore.setState({ token: 'tok' });
    renderWithProviders(<PortalNoDisponible />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    });

    expect(useProAuthStore.getState().status).toBe('anonymous');
    expect(localStorage.getItem(PRO_STORAGE_KEYS.token)).toBeNull();
  });

  it('el botón secundario también tiene alto táctil mínimo de 44 px', () => {
    useProAuthStore.setState({ token: 'tok' });
    renderWithProviders(<PortalNoDisponible />);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveStyle({ minHeight: '44px' });
  });
});
