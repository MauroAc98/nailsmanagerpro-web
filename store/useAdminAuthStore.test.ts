import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/adminService', () => ({
  adminService: {
    login: vi.fn(),
    logout: vi.fn(),
    tokenExpirado: vi.fn(() => false),
    getToken: vi.fn(() => null),
    getAdminGuardado: vi.fn(() => null),
  },
}));

import { adminService } from '@/services/adminService';
import { useAdminAuthStore } from './useAdminAuthStore';

const mockedLogin = vi.mocked(adminService.login);
const mockedLogout = vi.mocked(adminService.logout);
const mockedTokenExpirado = vi.mocked(adminService.tokenExpirado);

const ADMIN = { id: 1, name: 'Superadmin', email: 'admin@turnetto.app' };

beforeEach(() => {
  useAdminAuthStore.setState({
    admin: null,
    token: null,
    loading: false,
    error: null,
    inicializado: false,
    reautenticacionRequerida: false,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAdminAuthStore — reautenticación sin perder pantalla', () => {
  it('requerirReautenticacion pone el flag sin tocar admin/token', () => {
    useAdminAuthStore.setState({ admin: ADMIN, token: 'tok-viejo' });

    useAdminAuthStore.getState().requerirReautenticacion();

    const state = useAdminAuthStore.getState();
    expect(state.reautenticacionRequerida).toBe(true);
    expect(state.admin).toEqual(ADMIN);
    expect(state.token).toBe('tok-viejo');
  });

  it('revisarExpiracion pone el flag (no desloguea) cuando el token guardado está vencido', () => {
    useAdminAuthStore.setState({ admin: ADMIN, token: 'tok-viejo' });
    mockedTokenExpirado.mockReturnValue(true);

    useAdminAuthStore.getState().revisarExpiracion();

    const state = useAdminAuthStore.getState();
    expect(state.reautenticacionRequerida).toBe(true);
    expect(state.token).toBe('tok-viejo');
  });

  it('revisarExpiracion no hace nada sin token', () => {
    useAdminAuthStore.setState({ admin: null, token: null });
    mockedTokenExpirado.mockReturnValue(true);

    useAdminAuthStore.getState().revisarExpiracion();

    expect(useAdminAuthStore.getState().reautenticacionRequerida).toBe(false);
  });

  it('login exitoso reemplaza token/admin y limpia reautenticacionRequerida', async () => {
    useAdminAuthStore.setState({ reautenticacionRequerida: true, token: 'tok-viejo' });
    mockedLogin.mockResolvedValue({ admin: ADMIN, token: 'tok-nuevo', expires_at: '2026-12-01T00:00:00Z' });

    const ok = await useAdminAuthStore.getState().login('admin@turnetto.app', 'secreta');

    expect(ok).toBe(true);
    const state = useAdminAuthStore.getState();
    expect(state.token).toBe('tok-nuevo');
    expect(state.reautenticacionRequerida).toBe(false);
  });

  it('login fallido (password incorrecta durante el reingreso) mantiene el modal abierto', async () => {
    useAdminAuthStore.setState({ reautenticacionRequerida: true, token: 'tok-viejo', admin: ADMIN });
    mockedLogin.mockRejectedValue({ isAxiosError: true, response: { data: { message: 'Credenciales inválidas' } } });

    const ok = await useAdminAuthStore.getState().login('admin@turnetto.app', 'mal');

    expect(ok).toBe(false);
    const state = useAdminAuthStore.getState();
    expect(state.reautenticacionRequerida).toBe(true);
    expect(state.error).toBe('Credenciales inválidas');
  });

  it('logout limpia admin/token y reautenticacionRequerida aunque el POST al backend falle (token ya vencido)', async () => {
    useAdminAuthStore.setState({ admin: ADMIN, token: 'tok-viejo', reautenticacionRequerida: true });
    mockedLogout.mockRejectedValue(new Error('401'));

    await expect(useAdminAuthStore.getState().logout()).rejects.toThrow();

    // El finally de adminService.logout() ya limpió localStorage; acá
    // verificamos que el finally del store limpia el estado igual.
    const state = useAdminAuthStore.getState();
    expect(state.admin).toBeNull();
    expect(state.token).toBeNull();
    expect(state.reautenticacionRequerida).toBe(false);
  });
});
