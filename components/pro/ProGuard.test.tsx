import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen } from '@/test/render';
import { resetNavigationMock, routerMock, setMockLocation } from '@/test/mocks/nextNavigation';

vi.mock('next/navigation', async () => (await import('@/test/mocks/nextNavigation')).nextNavigationMock);

import { proService } from '@/services/proService';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import type { ProMe, ProVinculo } from '@/lib/pro/tipos';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { useProAuthStore } from '@/store/useProAuthStore';
import { ProGuard } from './ProGuard';

// El guard real contra el store real: lo único falso es la red (proService.me) y
// el router. Cubre SE-5 (S1-S5) y HR-7: el contenido solo se renderiza cuando la
// ruta está permitida y, mientras se decide, hay un Spinner (nunca el splash ni
// la bienvenida del tenant).

const EN_UNA_HORA = Date.now() + 3_600_000;

function vinculo(id: number, extra: Partial<ProVinculo> = {}): ProVinculo {
  return {
    id,
    negocioNombre: `Negocio ${id}`,
    profesional: { nombre: 'Ana', apellido: null, avatar_url: null },
    disponible: true,
    motivo: null,
    ...extra,
  };
}

const meCon = (vinculos: ProVinculo[]): ProMe => ({ email: 'ana@correo.com', vinculos, descartados: 0 });

function conSesion(tipo: 'full' | 'restricted', vinculos: ProVinculo[] = [vinculo(1)]) {
  proService.guardarSesion({ token: 'tok', tipo, expiresAt: EN_UNA_HORA });
  vi.spyOn(proService, 'me').mockResolvedValue(meCon(vinculos));
}

async function montar(pathname: string) {
  setMockLocation(pathname);
  const vista = renderWithProviders(
    <ProGuard>
      <div>CONTENIDO DEL PORTAL</div>
    </ProGuard>,
  );
  // Deja correr inicializar -> me -> efectos de navegación.
  await act(async () => {
    await Promise.resolve();
  });
  return vista;
}

const hijos = () => screen.queryByText('CONTENIDO DEL PORTAL');

beforeEach(() => {
  resetNavigationMock();
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  useLocaleStore.setState({ mensajesListos: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState(useAuthStore.getInitialState(), true);
});

describe('ProGuard — sin sesión (SE-5 S1)', () => {
  it('en la raíz manda al ingreso y no muestra el contenido', async () => {
    await montar('/');

    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith('/login');
    expect(hijos()).toBeNull();
  });

  it('en una pantalla protegida manda al ingreso', async () => {
    await montar('/agenda');
    expect(routerMock.replace).toHaveBeenCalledWith('/login');
    expect(hijos()).toBeNull();
  });

  it.each(['/login', '/olvide-password', '/restablecer-password'])('en %s muestra el contenido sin redirigir', async (ruta) => {
    await montar(ruta);

    expect(hijos()).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

describe('ProGuard — sesión restringida (SE-5 S2)', () => {
  it('desde la agenda manda al cambio de contraseña forzado y no pide `me`', async () => {
    conSesion('restricted');

    await montar('/agenda');

    expect(routerMock.replace).toHaveBeenCalledWith('/cambiar-password');
    expect(hijos()).toBeNull();
    expect(proService.me).not.toHaveBeenCalled();
  });

  it('en el cambio de contraseña muestra el contenido', async () => {
    conSesion('restricted');

    await montar('/cambiar-password');

    expect(hijos()).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

describe('ProGuard — sesión completa', () => {
  it('con varios negocios y ninguno elegido, la raíz manda a elegir (SE-5 S3)', async () => {
    conSesion('full', [vinculo(1), vinculo(2)]);

    await montar('/');

    expect(routerMock.replace).toHaveBeenCalledWith('/negocios');
    expect(hijos()).toBeNull();
  });

  it('con varios negocios y ninguno elegido, la agenda también manda a elegir', async () => {
    conSesion('full', [vinculo(1), vinculo(2)]);

    await montar('/agenda');

    expect(routerMock.replace).toHaveBeenCalledWith('/negocios');
  });

  it('con un único negocio, el ingreso manda a la agenda (SE-5 S4)', async () => {
    conSesion('full');

    await montar('/login');

    expect(routerMock.replace).toHaveBeenCalledWith('/agenda');
    expect(hijos()).toBeNull();
  });

  it('con un único negocio, la agenda muestra el contenido', async () => {
    conSesion('full');

    await montar('/agenda');

    expect(hijos()).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('con el negocio sin servicio, cualquier ruta manda a la pantalla de sin servicio', async () => {
    conSesion('full', [vinculo(1, { disponible: false, motivo: 'SUBSCRIPTION_SUSPENDED' })]);

    await montar('/agenda');

    expect(routerMock.replace).toHaveBeenCalledWith('/sin-servicio');
    expect(hijos()).toBeNull();
  });

  it('sin ningún negocio manda al acceso deshabilitado, sin pedir datos del negocio', async () => {
    conSesion('full', []);

    await montar('/agenda');

    expect(routerMock.replace).toHaveBeenCalledWith('/acceso-deshabilitado');
  });
});

describe('ProGuard — en localhost (rutas bajo /pro)', () => {
  it('sin sesión, /pro manda a /pro/login', async () => {
    await montar('/pro');
    expect(routerMock.replace).toHaveBeenCalledWith('/pro/login');
  });

  it('con sesión restringida, /pro/agenda manda a /pro/cambiar-password', async () => {
    conSesion('restricted');
    await montar('/pro/agenda');
    expect(routerMock.replace).toHaveBeenCalledWith('/pro/cambiar-password');
  });

  it('con sesión completa y un negocio, /pro manda a /pro/agenda', async () => {
    conSesion('full');
    await montar('/pro');
    expect(routerMock.replace).toHaveBeenCalledWith('/pro/agenda');
  });

  it('una ruta permitida bajo /pro muestra el contenido', async () => {
    await montar('/pro/login');
    expect(hijos()).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

describe('ProGuard — portal no disponible', () => {
  it('un error al cargar `me` NO cierra la sesión y manda a la pantalla de no disponible', async () => {
    proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: EN_UNA_HORA });
    vi.spyOn(proService, 'me').mockRejectedValue(Object.assign(new Error('x'), { proError: { kind: 'network' } }));

    await montar('/agenda');

    expect(routerMock.replace).toHaveBeenCalledWith('/no-disponible');
    expect(localStorage.getItem(PRO_STORAGE_KEYS.token)).toBe('tok');
  });

  it('el evento pro-portal-unavailable (un 404 del API) lleva a esa pantalla desde el ingreso', async () => {
    await montar('/login');
    routerMock.replace.mockClear();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('pro-portal-unavailable'));
    });

    expect(routerMock.replace).toHaveBeenCalledWith('/no-disponible');
    expect(hijos()).toBeNull();
  });

  it('en /no-disponible muestra el contenido', async () => {
    await montar('/login');
    await act(async () => {
      window.dispatchEvent(new CustomEvent('pro-portal-unavailable'));
    });
    routerMock.replace.mockClear();

    await act(async () => {
      setMockLocation('/no-disponible');
    });

    expect(hijos()).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

describe('ProGuard — mientras decide', () => {
  it('muestra un Spinner neutro y nada del tenant (HR-7 S1, SE-5 S5)', async () => {
    useAuthStore.setState({ mostrarBienvenida: true });
    const emitir = vi.spyOn(window, 'dispatchEvent');
    localStorage.setItem('auth_token', 'token-del-salon');

    await montar('/agenda');

    expect(screen.getByRole('status', { name: 'Un momento' })).toBeInTheDocument();
    expect(screen.queryByTestId('boot-splash')).toBeNull();
    expect(emitir).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth_token')).toBe('token-del-salon');
  });

  it('no usa el texto "Cargando..."', async () => {
    await montar('/agenda');
    expect(screen.queryByText(/cargando/i)).toBeNull();
  });

  it('con la sesión todavía cargando `me` no decide: ni contenido ni redirect', async () => {
    proService.guardarSesion({ token: 'tok', tipo: 'full', expiresAt: EN_UNA_HORA });
    vi.spyOn(proService, 'me').mockReturnValue(new Promise<ProMe>(() => undefined));

    await montar('/agenda');

    expect(useProAuthStore.getState().status).toBe('loadingMe');
    expect(hijos()).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Un momento' })).toBeInTheDocument();
  });

  it('hasta que los mensajes del idioma estén listos no decide nada', async () => {
    useLocaleStore.setState({ mensajesListos: false });
    await montar('/agenda');

    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(hijos()).toBeNull();

    await act(async () => {
      useLocaleStore.setState({ mensajesListos: true });
    });

    expect(routerMock.replace).toHaveBeenCalledWith('/login');
  });
});

describe('ProGuard — la sesión cambia con la pantalla abierta', () => {
  it('un 401 (pro-session-expired) saca el contenido y manda al ingreso, una sola vez', async () => {
    conSesion('full');
    await montar('/agenda');
    expect(hijos()).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('pro-session-expired'));
      window.dispatchEvent(new CustomEvent('pro-session-expired'));
      window.dispatchEvent(new CustomEvent('pro-session-expired'));
    });

    expect(hijos()).toBeNull();
    expect(useProAuthStore.getState().aviso).toBe('revoked');
    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith('/login');
  });

  it('el cierre de sesión en otra pestaña (storage) también lo manda al ingreso (SE-12 S3)', async () => {
    conSesion('full');
    await montar('/agenda');

    await act(async () => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    expect(hijos()).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith('/login');
  });

  it('al desmontar quita las escuchas: un 401 posterior ya no toca el store', async () => {
    conSesion('full');
    const vista = await montar('/agenda');
    vista.unmount();

    window.dispatchEvent(new CustomEvent('pro-session-expired'));

    expect(useProAuthStore.getState().status).toBe('full');
  });

  it('después de un redirect, al cambiar la ruta muestra el contenido de la nueva', async () => {
    conSesion('full');
    await montar('/login');
    expect(routerMock.replace).toHaveBeenCalledWith('/agenda');
    expect(hijos()).toBeNull();

    await act(async () => {
      setMockLocation('/agenda');
    });

    expect(hijos()).toBeInTheDocument();
  });
});
