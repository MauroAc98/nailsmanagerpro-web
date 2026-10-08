import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { routerMock, setMockLocation, resetNavigationMock, nextNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/services/adminService', () => ({
  adminService: {
    getToken: vi.fn(() => null),
    getAdminGuardado: vi.fn(() => null),
    tokenExpirado: vi.fn(() => false),
  },
}));

import api from '@/lib/api';
import Providers from './providers';
import AdminLayout from './(admin)/admin/layout';
import { tienePrefijoAdmin } from '@/lib/esPanelAdmin';
import { useAuthStore } from '@/store/useAuthStore';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

// Las dos guardas reales (salón en providers.tsx, panel en el layout de admin)
// montadas juntas, con una navegación simulada: cualquier router.push cambia la
// ubicación. Es lo que pasa en localhost, donde el panel vive bajo /admin y
// comparte localStorage con una sesión de salón abierta en otra pestaña.

let montajesLoginSalon = 0;

function LoginDelSalon() {
  // Equivale al LoginScreen real: cada montaje pide el branding del negocio.
  useEffect(() => { montajesLoginSalon += 1; }, []);
  return <div>LOGIN DEL SALON</div>;
}

function Pantallas() {
  const pathname = nextNavigationMock.usePathname();
  if (tienePrefijoAdmin(pathname)) {
    return (
      <AdminLayout>
        <div>{pathname === '/admin/login' ? 'LOGIN DEL PANEL' : 'INICIO DEL PANEL'}</div>
      </AdminLayout>
    );
  }
  return pathname === '/login' ? <LoginDelSalon /> : <div>PANTALLA DEL SALON</div>;
}

const navegar = (url: string) => {
  const i = url.indexOf('?');
  act(() => setMockLocation(i < 0 ? url : url.slice(0, i), i < 0 ? '' : url.slice(i)));
};

function sesionDeSalonAbierta() {
  localStorage.setItem('auth_token', 'tok');
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/auth/subscription-status') {
      return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
    }
    if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
    if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeEach(() => {
  resetNavigationMock();
  montajesLoginSalon = 0;
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(api.get).mockReset();
  routerMock.push.mockImplementation(navegar);
  useAuthStore.setState({
    token: null, user: null, inicializado: false, authStatus: 'booting', subscriptionChecked: false,
    subscriptionExpired: false, subscriptionCheckFailed: false, sessionEndOrigin: '',
    subscriptionBlockedOrigin: '', mostrarBienvenida: false,
  });
  useAdminAuthStore.setState({ admin: null, token: null, inicializado: false, reautenticacionRequerida: false });
  useLocaleStore.setState({ mensajesListos: false });
});

afterEach(() => vi.clearAllMocks());

describe.each([
  ['con una sesión de salón abierta', true],
  ['sin sesión de salón', false],
])('panel de admin bajo /admin, %s', (_nombre, conSalon) => {
  const montar = (ruta: string, search = '') => {
    if (conSalon) sesionDeSalonAbierta();
    setMockLocation(ruta, search);
    render(<Providers><Pantallas /></Providers>);
    act(() => useLocaleStore.setState({ mensajesListos: true }));
  };

  it('/admin sin sesión de admin termina en el login del panel y se queda ahí', async () => {
    montar('/admin');

    expect(await screen.findByText('LOGIN DEL PANEL')).toBeInTheDocument();
    await esperar(300);
    expect(screen.getByText('LOGIN DEL PANEL')).toBeInTheDocument();
    expect(montajesLoginSalon).toBe(0);
    expect(routerMock.push.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('/admin/login?redirect=%2Fadmin se muestra y nunca monta el login del salón', async () => {
    montar('/admin/login', '?redirect=%2Fadmin');

    expect(await screen.findByText('LOGIN DEL PANEL')).toBeInTheDocument();
    await esperar(300);
    expect(montajesLoginSalon).toBe(0);
    expect(routerMock.push).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('LOGIN DEL PANEL')).toBeInTheDocument());
  });
});
