import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { render, cleanup } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { routerMock, setMockLocation, resetNavigationMock } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import api from '@/lib/api';
import Providers from './providers';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';

const mockedGet = vi.mocked(api.get);

function markI18nReady() {
  act(() => {
    useLocaleStore.setState({ mensajesListos: true });
  });
}

const ORIGINAL_LOCATION = window.location;

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...ORIGINAL_LOCATION, hostname },
    configurable: true,
  });
}

beforeEach(() => {
  resetNavigationMock();
  mockedGet.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  setHostname(ORIGINAL_LOCATION.hostname);
  useAuthStore.setState({
    token: null,
    user: null,
    inicializado: false,
    authStatus: 'booting',
    subscriptionChecked: false,
    subscriptionExpired: false,
    subscriptionCheckFailed: false,
    sessionEndOrigin: '',
    subscriptionBlockedOrigin: '',
    mostrarBienvenida: false,
  });
  useLocaleStore.setState({ mensajesListos: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Providers — boot gate', () => {
  it('token present + checkSubscription pending -> renders the neutral BootSplash, not the protected children', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockReturnValue(new Promise(() => {})); // never settles

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('booting'));
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
    // Neutral splash while booting — never the personalized WelcomeScreen
    // (bug #15: that one asserts an authenticated session before we've
    // confirmed one).
    expect(screen.getByTestId('boot-splash')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
  });

  it('checkSubscription resolves ACTIVO -> protected children render', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('PROTECTED CONTENT')).toBeInTheDocument();
  });

  it('checkSubscription resolves ACTIVO -> WelcomeScreen shows only AFTER the session is confirmed (bug #15)', async () => {
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    expect(await screen.findByTestId('welcome-screen')).toBeInTheDocument();
    expect(useAuthStore.getState().mostrarBienvenida).toBe(true);
    // The flag was NOT set synchronously during inicializar() — only the
    // deferred, post-check path turns it on.
    expect(sessionStorage.getItem('bienvenida_mostrada')).toBe('1');
  });

  // Bug real reportado en produccion: el dueño del salon estaba logueado en
  // su propia cuenta (authStatus 'authenticated') en el mismo navegador
  // mientras probaba reservar.turnetto.com/testeo-dev — el WelcomeScreen
  // ("Buenos dias, {nombre}") le tapo la pantalla del flujo publico de
  // reserva online sola, sin tocar nada. `puedeMostrarContenido` ya excluye
  // reserva publica/admin del gate de auth, pero el render de WelcomeScreen
  // vivia en un `&&` aparte que nunca chequeaba el host.
  it('en reservar.turnetto.com nunca pinta el WelcomeScreen encima del flujo publico, aunque el dueño este logueado', async () => {
    setHostname('reservar.turnetto.com');
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/testeo-dev');
    render(<Providers><div>FLUJO PUBLICO</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('FLUJO PUBLICO')).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().mostrarBienvenida).toBe(true));
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
  });

  it('capturing the blocked-from route: expired user on a deep protected route -> subscriptionBlockedOrigin set before the redirect', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -3, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/clientes/5', '?tab=historia');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/subscription-expired'));
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('/clientes/5?tab=historia');
  });

  it('does not capture a non-protected route (already on /subscription-expired stays empty)', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -3, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/subscription-expired');
    render(<Providers><div>BLOCKED PAGE</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('subscription-blocked'));
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('');
  });

  it('server-revoked token at boot: all boot requests 401 -> lands unauthenticated on /login, never paints protected content, no modal', async () => {
    localStorage.setItem('auth_token', 'stale-revoked');
    // Every boot request 401s. The real axios interceptor clears storage and
    // emits `auth:session-revoked` from its async rejection handler; `@/lib/api`
    // is mocked here so mirror that side effect on a macrotask (by which point
    // the providers listener effect has run).
    mockedGet.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('auth:session-revoked'));
            reject({ response: { status: 401 } });
          }, 0);
        }),
    );

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('unauthenticated'));
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().subscriptionChecked).toBe(true);
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
    // Bug #15: the "Buenos días" splash must never paint over the /login
    // bounce when the stored token was already dead.
    expect(useAuthStore.getState().mostrarBienvenida).toBe(false);
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
    // Silent bounce to /login with the origin preserved — no session-ended modal
    // (the user never got in, there is no dimmed screen to keep).
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/agenda')}`,
      ),
    );
    expect(screen.queryByText('Tu sesión se cerró')).toBeNull();
  });

  it('false-expiry-flash regression: genuinely-expired user never renders protected children, goes to /subscription-expired', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'VENCIDO', days_left: -3, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    setMockLocation('/agenda');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/subscription-expired'));
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
    expect(routerMock.push).not.toHaveBeenCalledWith('/agenda');
    // Bug #15: an expired subscription lands in `subscription-blocked`, not
    // `authenticated`, so the WelcomeScreen stays suppressed.
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
  });
});

describe('Providers — graceful session revocation', () => {
  function mockActiveChecks() {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  }

  it('auth:session-revoked -> modal appears and the current screen is NOT blanked', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockActiveChecks();
    setMockLocation('/agenda');

    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();
    expect(await screen.findByText('PROTECTED CONTENT')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:session-revoked'));
    });

    expect(await screen.findByText('Tu sesión se cerró')).toBeInTheDocument();
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
    expect(useAuthStore.getState().authStatus).toBe('session-ending');
  });

  it('auth:subscription-suspect -> runs an authoritative recheck against /auth/subscription-status', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockActiveChecks();
    setMockLocation('/agenda');

    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();
    await screen.findByText('PROTECTED CONTENT');

    const before = mockedGet.mock.calls.filter(c => c[0] === '/auth/subscription-status').length;
    act(() => {
      window.dispatchEvent(new CustomEvent('auth:subscription-suspect'));
    });

    await waitFor(() =>
      expect(
        mockedGet.mock.calls.filter(c => c[0] === '/auth/subscription-status').length,
      ).toBe(before + 1),
    );
  });
});

describe('Providers — unauthenticated redirect', () => {
  it('no token on a protected route -> pushes /login with origin', async () => {
    setMockLocation('/clientes/5', '?tab=historia');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/clientes/5?tab=historia')}`,
      ),
    );
    expect(screen.queryByText('PROTECTED CONTENT')).toBeNull();
  });
});

// Bug real de prod: reservar.turnetto.com reescribe (proxy.ts/middleware.ts)
// TODO a /reservar/{slug} por dentro, pero eso es invisible para el browser —
// `usePathname()` en este guard puede leer el pathname SIN el prefijo
// /reservar (ver comentario largo en providers.tsx). Sin este corte por HOST,
// classifyTenant('/natalia-acosta') cae en 'protected' y el guard empuja a
// /login — que en ese mismo host vuelve a reescribirse a /reservar/login,
// matcheando el [slug] dinámico con slug="login" y disparando un fetch a
// /api/public/login/info que explota. Mismo patrón que ADMIN_HOST: cortar
// por host, nunca confiar en el pathname post-rewrite para este guard.
describe('Providers — reservar.turnetto.com (reserva pública)', () => {
  it('nunca redirige a /login, aunque el pathname (sin el prefijo /reservar) parezca protegido', async () => {
    setHostname('reservar.turnetto.com');
    setMockLocation('/natalia-acosta');
    render(<Providers><div>RESERVA CONTENT</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('RESERVA CONTENT')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('renderiza el contenido de entrada aunque authStatus siga booting', async () => {
    setHostname('reservar.turnetto.com');
    mockedGet.mockReturnValue(new Promise(() => {})); // nunca resuelve
    setMockLocation('/natalia-acosta');
    render(<Providers><div>RESERVA CONTENT</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('RESERVA CONTENT')).toBeInTheDocument();
  });

  it('el mismo pathname en app.turnetto.com sigue yendo a /login (no se rompió el guard normal)', async () => {
    setMockLocation('/natalia-acosta');
    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/natalia-acosta')}`,
      ),
    );
  });
});

describe('Providers — service worker', () => {
  const registro = { update: vi.fn(), unregister: vi.fn() };
  const sw = {
    register: vi.fn(),
    getRegistration: vi.fn(),
    getRegistrations: vi.fn(),
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const rechazosSinCapturar: unknown[] = [];
  const alRechazar = (motivo: unknown) => rechazosSinCapturar.push(motivo);

  beforeEach(() => {
    rechazosSinCapturar.length = 0;
    process.on('unhandledRejection', alRechazar);
    registro.update.mockReset();
    registro.unregister.mockReset().mockResolvedValue(true);
    sw.register.mockReset().mockResolvedValue(registro);
    sw.getRegistration.mockReset().mockResolvedValue(registro);
    sw.getRegistrations.mockReset().mockResolvedValue([registro]);
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    setMockLocation('/login');
  });

  afterEach(() => {
    cleanup(); // desmonta antes de quitar serviceWorker: el cleanup del efecto lo usa
    process.off('unhandledRejection', alRechazar);
    vi.unstubAllEnvs();
    // @ts-expect-error jsdom no trae serviceWorker: lo quitamos para no afectar otros tests
    delete navigator.serviceWorker;
  });

  const esperarUnTick = () => new Promise(resolve => setTimeout(resolve, 20));

  it('en producción registra /sw.js', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    registro.update.mockResolvedValue(undefined);
    render(<Providers><div>X</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(sw.register).toHaveBeenCalledWith('/sw.js'));
  });

  it('en producción, si buscar una actualización falla ("invalid state"), no queda un rechazo sin capturar', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    registro.update.mockRejectedValue(new DOMException('The object is in an invalid state.', 'InvalidStateError'));
    render(<Providers><div>X</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(registro.update).toHaveBeenCalled());
    await esperarUnTick();
    expect(rechazosSinCapturar).toEqual([]);
  });

  // Decisión P13: el SW del salón (push, caché del tenant) NO corre en el
  // portal de profesionales. Admin y la reserva pública no cambian.
  it('en profesionales.turnetto.com no registra el service worker del salón y da de baja uno heredado', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setHostname('profesionales.turnetto.com');
    setMockLocation('/login');
    render(<Providers><div>PORTAL</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(registro.unregister).toHaveBeenCalled());
    await esperarUnTick();
    expect(sw.register).not.toHaveBeenCalled();
    expect(registro.update).not.toHaveBeenCalled();
    expect(sw.addEventListener).not.toHaveBeenCalled();
  });

  it('en el portal da de baja TODAS las registraciones heredadas, no solo la primera', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const otro = { update: vi.fn(), unregister: vi.fn().mockResolvedValue(true) };
    sw.getRegistrations.mockResolvedValue([registro, otro]);
    setHostname('profesionales.turnetto.com');
    setMockLocation('/login');
    render(<Providers><div>PORTAL</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(otro.unregister).toHaveBeenCalledTimes(1));
    expect(registro.unregister).toHaveBeenCalledTimes(1);
  });

  it('el host del portal con mayúsculas y puerto tampoco registra /sw.js', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setHostname('PROFESIONALES.turnetto.com:443');
    setMockLocation('/login');
    render(<Providers><div>PORTAL</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(registro.unregister).toHaveBeenCalled());
    await esperarUnTick();
    expect(sw.register).not.toHaveBeenCalled();
  });

  it('un host que solo se parece al del portal sí registra /sw.js', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    registro.update.mockResolvedValue(undefined);
    setHostname('profesionales.turnetto.com.evil.com');
    setMockLocation('/login');
    render(<Providers><div>X</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(sw.register).toHaveBeenCalledWith('/sw.js'));
  });

  it('en localhost bajo /pro tampoco registra el service worker del salón', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setMockLocation('/pro/login');
    render(<Providers><div>PORTAL</div></Providers>);
    markI18nReady();

    await esperarUnTick();
    expect(sw.register).not.toHaveBeenCalled();
  });

  it.each(['admin.turnetto.com', 'reservar.turnetto.com'])('en %s sigue registrando /sw.js', async (host) => {
    vi.stubEnv('NODE_ENV', 'production');
    registro.update.mockResolvedValue(undefined);
    setHostname(host);
    setMockLocation('/');
    render(<Providers><div>X</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(sw.register).toHaveBeenCalledWith('/sw.js'));
  });

  it('fuera de producción no registra el service worker y da de baja el que quedó de un build anterior', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<Providers><div>X</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(registro.unregister).toHaveBeenCalled());
    expect(sw.register).not.toHaveBeenCalled();
    expect(registro.update).not.toHaveBeenCalled();
  });
});

describe('Providers — renderizado en servidor del panel de admin', () => {
  // En el servidor no hay window: si la guarda del salón solo supiera responder
  // "¿es el panel?" con window, el HTML del servidor traería el BootSplash y el
  // cliente (que sí sabe) pintaría el layout del admin: "Hydration failed".
  const enServidor = (ruta: string) => {
    setMockLocation(ruta);
    vi.stubGlobal('window', undefined);
    try {
      return renderToString(<Providers><div>PANEL</div></Providers>);
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it('bajo /admin el servidor renderiza el contenido, no el BootSplash', () => {
    const html = enServidor('/admin');

    expect(html).toContain('PANEL');
    expect(html).not.toContain('boot-splash');
  });

  it('bajo /admin/login también', () => {
    expect(enServidor('/admin/login')).toContain('PANEL');
  });

  it('una pantalla del salón sigue mostrando el BootSplash mientras arranca', () => {
    const html = enServidor('/agenda');

    expect(html).toContain('boot-splash');
    expect(html).not.toContain('PANEL');
  });
});

// Providers corre también en admin.turnetto.com y bajo /admin, pero el arranque
// del salón (validar sesión y suscripción, polling de /auth/me, estado de
// conexión) no tiene sentido ahí y generaba requests al API del salón.
describe('Providers — arranque del salón fuera del panel de admin', () => {
  const refrescar = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    refrescar.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sesionDelSalonAbierta() {
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  }

  it('en admin.turnetto.com no valida la sesión del salón ni llama al API del salón', async () => {
    setHostname('admin.turnetto.com');
    sesionDelSalonAbierta();
    setMockLocation('/');

    render(<Providers><div>PANEL</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('PANEL')).toBeInTheDocument();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(mockedGet).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authStatus).toBe('booting');
  });

  it('bajo /admin (app.turnetto.com/admin, localhost) tampoco', async () => {
    sesionDelSalonAbierta();
    setMockLocation('/admin');

    render(<Providers><div>PANEL</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('PANEL')).toBeInTheDocument();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('en admin.turnetto.com no hace el refresco periódico del estado del negocio, aunque haya sesión del salón', async () => {
    setHostname('admin.turnetto.com');
    useAuthStore.setState({
      authStatus: 'authenticated',
      user: { id: 1 } as never,
      refrescarEstadoNegocio: refrescar,
    });
    setMockLocation('/');

    render(<Providers><div>PANEL</div></Providers>);
    markI18nReady();
    await screen.findByText('PANEL');

    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 20_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refrescar).not.toHaveBeenCalled();
  });

  it('en app.turnetto.com todo sigue igual: valida la sesión y refresca el estado del negocio', async () => {
    sesionDelSalonAbierta();
    setMockLocation('/agenda');

    render(<Providers><div>PROTECTED CONTENT</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('PROTECTED CONTENT')).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith('/auth/subscription-status');

    useAuthStore.setState({ refrescarEstadoNegocio: refrescar });
    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 20_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('al pasar de una pantalla del panel a una del salón (sin recargar), el arranque del salón corre entonces', async () => {
    sesionDelSalonAbierta();
    setMockLocation('/admin');

    render(<Providers><div>CONTENIDO</div></Providers>);
    markI18nReady();
    await screen.findByText('CONTENIDO');
    expect(mockedGet).not.toHaveBeenCalled();

    act(() => {
      setMockLocation('/agenda');
    });

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/auth/subscription-status'));
  });
});

// Portal de profesionales (profesionales.turnetto.com, o /pro en localhost):
// otra superficie con su propia sesión (P3+). Este guard del salón no puede
// validar la sesión del salón, re-enlazar push, pintar la bienvenida ni empujar
// a /login: sería expulsar a la profesional de su propio portal. Cada sitio
// donde hoy se exime al panel de admin se prueba con admin y con el portal.
describe.each([
  ['admin.turnetto.com', '/', 'panel de admin'],
  ['profesionales.turnetto.com', '/agenda', 'portal en profesionales.turnetto.com'],
  ['localhost', '/pro/agenda', 'portal bajo /pro en localhost'],
])('Providers — superficie ajena al salón: %s%s (%s)', (host, ruta) => {
  const refrescar = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    refrescar.mockClear();
    setHostname(host);
    setMockLocation(ruta);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sesionDelSalonAbierta() {
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  }

  const esperarUnTick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

  it('renderiza el contenido y no el BootSplash del salón, aunque authStatus siga booting', async () => {
    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('SUPERFICIE')).toBeInTheDocument();
    expect(screen.queryByTestId('boot-splash')).toBeNull();
  });

  it('no valida la sesión del salón ni llama al API del salón, aunque haya una abierta', async () => {
    sesionDelSalonAbierta();

    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();

    await screen.findByText('SUPERFICIE');
    await esperarUnTick();
    expect(mockedGet).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authStatus).toBe('booting');
  });

  it('no hace el refresco periódico del estado del negocio', async () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      user: { id: 1 } as never,
      refrescarEstadoNegocio: refrescar,
    });

    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();
    await screen.findByText('SUPERFICIE');

    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 20_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refrescar).not.toHaveBeenCalled();
  });

  // `unauthenticated` (no `booting`): con booting el resolver devuelve blank y el
  // efecto de redirección ni se evalúa. Sin la exención, este estado empuja a
  // /login (ver el control en app.turnetto.com más abajo).
  it('sin sesión del salón (unauthenticated) nunca redirige a /login del salón', async () => {
    useAuthStore.setState({ authStatus: 'unauthenticated' });

    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('SUPERFICIE')).toBeInTheDocument();
    await esperarUnTick();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('nunca pinta el WelcomeScreen del salón, aunque haya una sesión autenticada con la bienvenida pendiente', async () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      user: { id: 1, name: 'Estudio Ana' } as never,
      mostrarBienvenida: true,
    });

    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('SUPERFICIE')).toBeInTheDocument();
    expect(useAuthStore.getState().mostrarBienvenida).toBe(true);
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
  });

  it('con la suscripción del salón vencida no la manda a /subscription-expired ni guarda el origen', async () => {
    useAuthStore.setState({ authStatus: 'subscription-blocked' });

    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('SUPERFICIE')).toBeInTheDocument();
    await esperarUnTick();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('');
  });

  it('no limpia el origen de suscripción bloqueada del salón (ese estado no es de esta superficie)', async () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      subscriptionBlockedOrigin: '/clientes/5',
    });

    render(<Providers><div>SUPERFICIE</div></Providers>);
    markI18nReady();

    await screen.findByText('SUPERFICIE');
    await esperarUnTick();
    expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe('/clientes/5');
  });

});

describe('Providers — control: la misma pantalla en el salón sí redirige', () => {
  it('app.turnetto.com/agenda unauthenticated empuja a /login con el origen (hace no vacío el test de arriba)', async () => {
    setHostname('app.turnetto.com');
    setMockLocation('/agenda');
    useAuthStore.setState({ authStatus: 'unauthenticated' });

    render(<Providers><div>SALON</div></Providers>);
    markI18nReady();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/agenda')}`),
    );
  });
});

describe('Providers — el prefijo /pro solo exime en hosts internos o sin host', () => {
  it('en app.turnetto.com, /pro/x NO se exime: el guard del salón manda a /login (defensa en profundidad, S6)', async () => {
    setHostname('app.turnetto.com');
    setMockLocation('/pro/x');

    render(<Providers><div>CONTENIDO</div></Providers>);
    markI18nReady();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/pro/x')}`),
    );
    expect(screen.queryByText('CONTENIDO')).toBeNull();
  });

  it('en cualquier otro host externo, /pro/x tampoco se exime', async () => {
    setHostname('otro.example.com');
    setMockLocation('/pro/x');

    render(<Providers><div>CONTENIDO</div></Providers>);
    markI18nReady();

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent('/pro/x')}`),
    );
    expect(screen.queryByText('CONTENIDO')).toBeNull();
  });

  it('en localhost, /pro/x SÍ se exime: renderiza y no redirige', async () => {
    setHostname('localhost');
    setMockLocation('/pro/x');

    render(<Providers><div>CONTENIDO</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('CONTENIDO')).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe('Providers — reservar.turnetto.com no cambia al sumar el portal (regresión)', () => {
  // reservar NO es "ajena al salón" para el arranque: sigue validando la sesión
  // del salón y refrescando el estado del negocio (solo se exime donde hoy ya
  // se eximía: redirect, contenido, bienvenida y push). Estos tests fijan eso.
  const refrescar = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    refrescar.mockClear();
    setHostname('reservar.turnetto.com');
    setMockLocation('/natalia-acosta');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sigue arrancando la sesión del salón (valida la suscripción) si hay una abierta', async () => {
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(<Providers><div>RESERVA</div></Providers>);
    markI18nReady();

    expect(await screen.findByText('RESERVA')).toBeInTheDocument();
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/auth/subscription-status'));
  });

  it('sigue refrescando el estado del negocio al volver a la app', async () => {
    // El arranque del salón corre acá (es justo lo que se fija), así que la
    // sesión tiene que ser real: un authStatus puesto a mano lo pisaría.
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    render(<Providers><div>RESERVA</div></Providers>);
    markI18nReady();
    await screen.findByText('RESERVA');
    await waitFor(() => expect(useAuthStore.getState().authStatus).toBe('authenticated'));

    useAuthStore.setState({ refrescarEstadoNegocio: refrescar });
    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 20_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('sigue limpiando el origen de suscripción bloqueada una vez autenticado', async () => {
    useAuthStore.setState({
      authStatus: 'authenticated',
      subscriptionBlockedOrigin: '/clientes/5',
    });

    render(<Providers><div>RESERVA</div></Providers>);
    markI18nReady();

    await screen.findByText('RESERVA');
    await waitFor(() => expect(useAuthStore.getState().subscriptionBlockedOrigin).toBe(''));
  });
});

describe('Providers — renderizado en servidor del portal de profesionales', () => {
  // Igual que con el panel de admin: en el servidor no hay window, así que bajo
  // /pro decide el prefijo. En profesionales.turnetto.com (URL limpia, solo
  // reconocible por host) el servidor sigue dibujando el BootSplash del salón y
  // el cliente se recupera regenerando el árbol: discrepancia conocida y aceptada.
  const enServidor = (ruta: string) => {
    setMockLocation(ruta);
    vi.stubGlobal('window', undefined);
    try {
      return renderToString(<Providers><div>PORTAL</div></Providers>);
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it('bajo /pro el servidor renderiza el contenido, no el BootSplash', () => {
    const html = enServidor('/pro/login');

    expect(html).toContain('PORTAL');
    expect(html).not.toContain('boot-splash');
  });

  it('una pantalla del salón con nombre parecido sigue mostrando el BootSplash', () => {
    const html = enServidor('/professionals');

    expect(html).toContain('boot-splash');
    expect(html).not.toContain('PORTAL');
  });
});

// El logout borra solo el vínculo push en el servidor (permiso y suscripción del
// navegador quedan): al volver a entrar se re-enlaza sola, pero únicamente en el
// salón — nunca en el panel de admin ni en la reserva pública.
describe('Providers — re-enlace silencioso de avisos push', () => {
  const suscripcion = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }),
  };
  const registro = {
    update: vi.fn(),
    unregister: vi.fn().mockResolvedValue(true),
    pushManager: { getSubscription: vi.fn() },
  };
  const sw = {
    register: vi.fn(),
    getRegistration: vi.fn(),
    getRegistrations: vi.fn(),
    controller: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const mockedPost = vi.mocked(api.post);

  beforeEach(() => {
    registro.pushManager.getSubscription.mockReset().mockResolvedValue(suscripcion);
    sw.getRegistration.mockReset().mockResolvedValue(registro);
    sw.getRegistrations.mockReset().mockResolvedValue([registro]);
    sw.register.mockReset().mockResolvedValue(registro);
    mockedPost.mockReset().mockResolvedValue({ data: {} });
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    vi.stubGlobal('Notification', { permission: 'granted' });
    (window as unknown as Record<string, unknown>).Notification = { permission: 'granted' };
    (window as unknown as Record<string, unknown>).PushManager = function PushManager() {};
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', JSON.stringify({ name: 'Estudio Ana', slug: 'ana' }));
    mockedGet.mockImplementation((url: string) => {
      if (url === '/auth/subscription-status') {
        return Promise.resolve({ data: { status: 'ACTIVO', days_left: 30, ends_at: null, is_exempt: false } });
      }
      if (url === '/support-info') return Promise.resolve({ data: { whatsapp: '', email: '', subscription_warning_days: 7 } });
      if (url === '/auth/me') return Promise.resolve({ data: { locale: 'es', whatsapp_requiere_envio_manual: false } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
  });

  afterEach(() => {
    cleanup(); // desmonta antes de quitar serviceWorker: el cleanup del efecto lo usa
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).Notification;
    delete (window as unknown as Record<string, unknown>).PushManager;
    // @ts-expect-error jsdom no trae serviceWorker: lo quitamos para no afectar otros tests
    delete navigator.serviceWorker;
  });

  const esperarUnTick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  const llamadasPush = () => mockedPost.mock.calls.filter(([url]) => url === '/push/subscriptions');

  it('en el salón, con sesión iniciada, re-enlaza la suscripción existente', async () => {
    setMockLocation('/agenda');
    render(<Providers><div>SALON</div></Providers>);
    markI18nReady();

    await waitFor(() => expect(llamadasPush()).toHaveLength(1));
    expect(llamadasPush()[0][1]).toMatchObject({ endpoint: 'https://push.example/abc' });
  });

  it('en admin.turnetto.com no corre, aunque haya una sesión del salón abierta', async () => {
    setHostname('admin.turnetto.com');
    useAuthStore.setState({ authStatus: 'authenticated', user: { id: 1 } as never });
    setMockLocation('/');
    render(<Providers><div>PANEL</div></Providers>);
    markI18nReady();

    await screen.findByText('PANEL');
    await esperarUnTick();
    expect(registro.pushManager.getSubscription).not.toHaveBeenCalled();
    expect(llamadasPush()).toHaveLength(0);
  });

  it('en reservar.turnetto.com no corre, aunque haya una sesión del salón abierta', async () => {
    setHostname('reservar.turnetto.com');
    useAuthStore.setState({ authStatus: 'authenticated', user: { id: 1 } as never });
    setMockLocation('/natalia-acosta');
    render(<Providers><div>RESERVA</div></Providers>);
    markI18nReady();

    await screen.findByText('RESERVA');
    await esperarUnTick();
    expect(registro.pushManager.getSubscription).not.toHaveBeenCalled();
    expect(llamadasPush()).toHaveLength(0);
  });

  it.each([
    ['profesionales.turnetto.com', '/agenda'],
    ['localhost', '/pro/agenda'],
  ])('en el portal de profesionales (%s%s) no corre, aunque haya una sesión del salón abierta', async (host, ruta) => {
    setHostname(host);
    useAuthStore.setState({ authStatus: 'authenticated', user: { id: 1 } as never });
    setMockLocation(ruta);
    render(<Providers><div>PORTAL</div></Providers>);
    markI18nReady();

    await screen.findByText('PORTAL');
    await esperarUnTick();
    expect(registro.pushManager.getSubscription).not.toHaveBeenCalled();
    expect(llamadasPush()).toHaveLength(0);
  });
});
