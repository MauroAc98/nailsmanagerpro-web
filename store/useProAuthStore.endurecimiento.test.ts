import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AxiosError } from 'axios';
import { proService, type ProSesion } from '@/services/proService';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import type { ProError } from '@/lib/pro/errores';
import type { ProMe, ProVinculo } from '@/lib/pro/tipos';
import { iniciarEscuchasPro, registrarResetPorNegocio, useProAuthStore } from './useProAuthStore';

// Endurecimiento de la sesión del portal (revisión independiente de P4):
// sincronización entre pestañas de SOLO LECTURA, carreras de login/logout,
// estados inconsistentes de `me` y contadores de generación/época.

const AHORA = Date.parse('2026-10-17T12:00:00Z');
const EN_UNA_HORA = AHORA + 3_600_000;
const EN_DOS_HORAS = AHORA + 7_200_000;
const A_LOS_15_MIN = AHORA + 15 * 60_000;

const store = () => useProAuthStore.getState();
async function flush() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

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
const rechazo = (proError: ProError) => Object.assign(new Error('rechazado'), { proError });
const sesion = (tipo: ProSesion['tipo'], extra: Partial<ProSesion> = {}): ProSesion => ({
  token: 'tok-nuevo',
  tipo,
  expiresAt: EN_UNA_HORA,
  ...extra,
});
const enStorage = (clave: string) => localStorage.getItem(clave);
const claves = () => [PRO_STORAGE_KEYS.token, PRO_STORAGE_KEYS.tipo, PRO_STORAGE_KEYS.expiresAt].map(enStorage);

function conSesionGuardada(tipo: 'full' | 'restricted' = 'full', token = 'tok-A', expiresAt = EN_UNA_HORA) {
  expect(proService.guardarSesion({ token, tipo, expiresAt })).toBe(true);
}

let me: MockInstance<typeof proService.me>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  me = vi.spyOn(proService, 'me').mockResolvedValue(meCon([vinculo(1)]));
  vi.spyOn(proService, 'logout').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('sincronización entre pestañas — nunca destruye lo que otra pestaña escribe', () => {
  // La otra pestaña (guardarSesion) escribe token, tipo y vencimiento de a una
  // key; cada setItem dispara un evento `storage` en ESTA pestaña.
  function escribir(clave: string, valor: string) {
    localStorage.setItem(clave, valor);
    store().sincronizarDesdeStorage();
  }

  it('un login nuevo escrito key por key sobre una pestaña anónima termina adoptado y sin borrar nada', async () => {
    store().inicializar();
    expect(store().status).toBe('anonymous');

    escribir(PRO_STORAGE_KEYS.token, 'tok-B');
    expect(claves()).toEqual(['tok-B', null, null]);
    expect(store().status).toBe('anonymous');

    escribir(PRO_STORAGE_KEYS.tipo, 'full');
    expect(claves()).toEqual(['tok-B', 'full', null]);
    expect(store().status).toBe('anonymous');

    escribir(PRO_STORAGE_KEYS.expiresAt, String(EN_UNA_HORA));
    await flush();

    expect(claves()).toEqual(['tok-B', 'full', String(EN_UNA_HORA)]);
    expect(store().status).toBe('full');
    expect(store().token).toBe('tok-B');
    expect(store().expiresAt).toBe(EN_UNA_HORA);
  });

  it('un cambio de sesión (full -> restricted de otra cuenta) a medio escribir conserva lo escrito y termina coherente', async () => {
    conSesionGuardada('full', 'tok-A');
    store().inicializar();
    await flush();
    expect(store().status).toBe('full');

    escribir(PRO_STORAGE_KEYS.token, 'tok-B');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-B');
    escribir(PRO_STORAGE_KEYS.tipo, 'restricted');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('restricted');
    escribir(PRO_STORAGE_KEYS.expiresAt, String(A_LOS_15_MIN));
    await flush();

    expect(claves()).toEqual(['tok-B', 'restricted', String(A_LOS_15_MIN)]);
    expect(store().status).toBe('restricted');
    expect(store().token).toBe('tok-B');
    expect(store().expiresAt).toBe(A_LOS_15_MIN);
  });

  it('con la sesión anterior vencida, el token nuevo a medio escribir NO se interpreta como "mi sesión venció"', async () => {
    conSesionGuardada('full', 'tok-A', AHORA + 1000);
    store().inicializar();
    await flush();
    vi.setSystemTime(AHORA + 2000);

    // La pestaña B escribe el token nuevo: tipo y vencimiento todavía son los viejos (vencidos).
    escribir(PRO_STORAGE_KEYS.token, 'tok-B');

    expect(claves()).toEqual(['tok-B', 'full', String(AHORA + 1000)]);
    expect(store().aviso).toBeNull();

    escribir(PRO_STORAGE_KEYS.tipo, 'full');
    escribir(PRO_STORAGE_KEYS.expiresAt, String(EN_DOS_HORAS));
    await flush();

    expect(claves()).toEqual(['tok-B', 'full', String(EN_DOS_HORAS)]);
    expect(store().status).toBe('full');
    expect(store().token).toBe('tok-B');
  });

  it('visibilitychange con una sesión nueva a medio escribir tampoco borra nada', async () => {
    conSesionGuardada('full', 'tok-A', AHORA + 1000);
    store().inicializar();
    await flush();
    vi.setSystemTime(AHORA + 2000);
    const quitar = iniciarEscuchasPro();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok-B');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(claves()).toEqual(['tok-B', 'full', String(AHORA + 1000)]);
    expect(store().aviso).toBeNull();
    quitar();
  });

  it('revisarExpiracion no borra el storage si la sesión guardada ya es de otro token', async () => {
    conSesionGuardada('full', 'tok-A', AHORA + 1000);
    store().inicializar();
    await flush();
    vi.setSystemTime(AHORA + 2000);
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok-B');
    localStorage.setItem(PRO_STORAGE_KEYS.expiresAt, String(EN_DOS_HORAS));

    store().revisarExpiracion();
    await flush();

    expect(claves()).toEqual(['tok-B', 'full', String(EN_DOS_HORAS)]);
    expect(store().token).toBe('tok-B');
    expect(store().status).toBe('full');
  });

  it('si la otra pestaña borra SOLO el token, esta cierra sesión (logout genuino)', async () => {
    conSesionGuardada('full', 'tok-A');
    store().inicializar();
    await flush();

    localStorage.removeItem(PRO_STORAGE_KEYS.token);
    store().sincronizarDesdeStorage();

    expect(store().status).toBe('anonymous');
  });

  it('cerrar sesión por sincronización no borra las keys que otra pestaña pueda estar escribiendo', async () => {
    conSesionGuardada('full', 'tok-A');
    store().inicializar();
    await flush();
    // logout en B: borra el token; B empieza a escribir un login nuevo (tipo) antes de que lleguemos.
    localStorage.removeItem(PRO_STORAGE_KEYS.token);
    localStorage.removeItem(PRO_STORAGE_KEYS.expiresAt);
    localStorage.setItem(PRO_STORAGE_KEYS.tipo, 'full');

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('anonymous');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('full');
  });

  it('una sesión corrupta (token sin tipo válido) no se borra desde el camino de sincronización', async () => {
    store().inicializar();
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok-B');
    localStorage.setItem(PRO_STORAGE_KEYS.tipo, 'rarisimo');
    localStorage.setItem(PRO_STORAGE_KEYS.expiresAt, 'abc');

    store().sincronizarDesdeStorage();

    expect(claves()).toEqual(['tok-B', 'rarisimo', 'abc']);
    expect(store().status).toBe('anonymous');
  });

  it('el mismo token vencido SÍ cierra la sesión con aviso `expired`', async () => {
    conSesionGuardada('full', 'tok-A', AHORA + 1000);
    store().inicializar();
    await flush();
    vi.setSystemTime(AHORA + 2000);

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
  });
});

describe('eventos storage — área de almacenamiento', () => {
  let quitar: () => void;
  beforeEach(() => {
    quitar = iniciarEscuchasPro();
  });
  afterEach(() => quitar());

  async function conSesion() {
    conSesionGuardada('full');
    store().inicializar();
    await flush();
    const sincronizar = vi.fn();
    useProAuthStore.setState({ sincronizarDesdeStorage: sincronizar });
    return sincronizar;
  }

  // Evento armado a mano: jsdom no deja construir un StorageEvent con un área
  // que no sea un Storage real.
  function eventoStorage(key: string | null, storageArea: unknown) {
    const evento = new Event('storage');
    Object.defineProperty(evento, 'key', { value: key });
    Object.defineProperty(evento, 'storageArea', { value: storageArea });
    window.dispatchEvent(evento);
  }

  it('un evento de sessionStorage con una key de la sesión se ignora', async () => {
    const sincronizar = await conSesion();

    eventoStorage(PRO_STORAGE_KEYS.token, sessionStorage);
    eventoStorage(null, sessionStorage);

    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('un evento de un área ajena (ni local ni session) se ignora, también con key null', async () => {
    const sincronizar = await conSesion();
    const ajena = {};

    eventoStorage(PRO_STORAGE_KEYS.token, ajena);
    eventoStorage(null, ajena);

    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('un evento de localStorage con una key de la sesión sí se procesa', async () => {
    const sincronizar = await conSesion();

    eventoStorage(PRO_STORAGE_KEYS.token, localStorage);

    expect(sincronizar).toHaveBeenCalledTimes(1);
  });
});

describe('me — estados inconsistentes', () => {
  function error403SinCodigo(): Error {
    const config = { headers: {} } as never;
    const axiosError = new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, null, {
      status: 403,
      statusText: '',
      data: { message: 'This action is unauthorized.' },
      headers: {},
      config,
    });
    return Object.assign(axiosError, { proError: { kind: 'server' } satisfies ProError });
  }

  it('un 403 sin código con la sesión guardada como `full` (tipo adulterado) cierra la sesión en vez de quedar en un callejón', async () => {
    // El token real es restringido, pero pro_token_tipo fue cambiado a `full`.
    conSesionGuardada('full', 'tok-restringido');
    me.mockRejectedValue(error403SinCodigo());

    store().inicializar();
    await flush();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('revoked');
    expect(claves()).toEqual([null, null, null]);
  });

  it('un 500 real NO cierra la sesión (se distingue del 403 sin código)', async () => {
    conSesionGuardada('full');
    const config = { headers: {} } as never;
    me.mockRejectedValue(
      Object.assign(
        new AxiosError('x', 'ERR_BAD_RESPONSE', config, null, { status: 500, statusText: '', data: {}, headers: {}, config }),
        { proError: { kind: 'server' } satisfies ProError },
      ),
    );

    store().inicializar();
    await flush();

    expect(store().status).toBe('portalUnavailable');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-A');
  });

  it('cargarMe con la sesión restringida no hace ninguna llamada', async () => {
    conSesionGuardada('restricted', 'tok-R', A_LOS_15_MIN);
    store().inicializar();
    expect(store().status).toBe('restricted');

    await store().cargarMe();

    expect(me).not.toHaveBeenCalled();
    expect(store().status).toBe('restricted');
  });

  it('un `me` en vuelo cuando el portal se marca no disponible se descarta', async () => {
    conSesionGuardada('full');
    let responder: (m: ProMe) => void = () => undefined;
    me.mockReturnValue(new Promise<ProMe>((resolve) => (responder = resolve)));
    store().inicializar();

    store().marcarPortalNoDisponible();
    responder(meCon([vinculo(1)]));
    await flush();

    expect(store().status).toBe('portalUnavailable');
    expect(store().vinculos).toEqual([]);
  });

  it('el evento pro-portal-unavailable también descarta el `me` en vuelo', async () => {
    conSesionGuardada('full');
    let responder: (m: ProMe) => void = () => undefined;
    me.mockReturnValue(new Promise<ProMe>((resolve) => (responder = resolve)));
    store().inicializar();
    const quitar = iniciarEscuchasPro();

    window.dispatchEvent(new CustomEvent('pro-portal-unavailable'));
    responder(meCon([vinculo(1)]));
    await flush();

    expect(store().status).toBe('portalUnavailable');
    expect(store().vinculos).toEqual([]);
    quitar();
  });
});

describe('logout — carreras', () => {
  it('un logout lento NO borra una sesión más nueva adoptada por sincronización mientras tanto', async () => {
    conSesionGuardada('full', 'tok-A');
    store().inicializar();
    await flush();
    let terminar: () => void = () => undefined;
    vi.spyOn(proService, 'logout').mockReturnValue(new Promise<void>((resolve) => (terminar = resolve)));

    const saliendo = store().logout();
    // Mientras viaja el POST, otra pestaña inicia sesión con otra cuenta y esta la adopta.
    conSesionGuardada('full', 'tok-B', EN_DOS_HORAS);
    store().sincronizarDesdeStorage();
    await flush();
    expect(store().token).toBe('tok-B');
    terminar();
    await saliendo;

    expect(store().token).toBe('tok-B');
    expect(store().status).toBe('full');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-B');
  });

  it('un logout normal sigue limpiando todo', async () => {
    conSesionGuardada('full', 'tok-A');
    store().inicializar();
    await flush();

    await store().logout();

    expect(store().status).toBe('anonymous');
    expect(claves()).toEqual([null, null, null]);
  });
});

describe('login — carreras', () => {
  let login: MockInstance<typeof proService.login>;
  beforeEach(() => {
    login = vi.spyOn(proService, 'login');
    store().inicializar();
  });

  it('dos llamadas concurrentes mandan un solo request y comparten el resultado', async () => {
    let responder: (s: ProSesion) => void = () => undefined;
    login.mockReturnValue(new Promise<ProSesion>((resolve) => (responder = resolve)));

    const primera = store().login('ana@correo.com', 'clave-larga-1');
    const segunda = store().login('ana@correo.com', 'clave-larga-1');
    responder(sesion('full'));

    expect(await primera).toBeNull();
    expect(await segunda).toBeNull();
    expect(login).toHaveBeenCalledTimes(1);
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('después de terminar, un login nuevo vuelve a mandar el request', async () => {
    login.mockRejectedValue(rechazo({ kind: 'invalidCredentials' }));

    await store().login('ana@correo.com', 'mala');
    await store().login('ana@correo.com', 'mala');

    expect(login).toHaveBeenCalledTimes(2);
  });

  it('un login que responde después de que otra pestaña inició sesión NO pisa la sesión adoptada', async () => {
    let responder: (s: ProSesion) => void = () => undefined;
    login.mockReturnValue(new Promise<ProSesion>((resolve) => (responder = resolve)));

    const pendiente = store().login('ana@correo.com', 'clave-larga-1');
    conSesionGuardada('full', 'tok-otra-pestana', EN_DOS_HORAS);
    store().sincronizarDesdeStorage();
    await flush();
    expect(store().token).toBe('tok-otra-pestana');
    responder(sesion('full', { token: 'tok-de-este-login' }));
    const error = await pendiente;

    expect(error).toBeNull();
    expect(store().token).toBe('tok-otra-pestana');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-otra-pestana');
  });
});

describe('limpieza consistente y contadores', () => {
  it('expirar también borra pro_ultimo_vinculo', async () => {
    conSesionGuardada('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    store().inicializar();
    await flush();
    store().elegirVinculo(2);
    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBe('2');

    store().expirar('expired');

    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBeNull();
  });

  it('epochNegocio sube con cada reinicio de datos por negocio y no con una elección repetida', async () => {
    conSesionGuardada('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    store().inicializar();
    await flush();
    const inicial = store().epochNegocio;

    store().elegirVinculo(1);
    const trasPrimera = store().epochNegocio;
    store().elegirVinculo(1);
    expect(store().epochNegocio).toBe(trasPrimera);

    store().elegirVinculo(2);
    expect(store().epochNegocio).toBeGreaterThan(trasPrimera);
    expect(trasPrimera).toBeGreaterThanOrEqual(inicial);
  });

  it('un reset que falla se registra con un texto fijo, sin el error que trae el slice', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const quitar = registrarResetPorNegocio(() => {
      throw new Error('contenido-sensible-del-slice');
    });
    conSesionGuardada('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    store().inicializar();
    await flush();
    store().elegirVinculo(1);

    store().elegirVinculo(2);

    expect(consola).toHaveBeenCalled();
    const argumentos = consola.mock.calls.flat();
    expect(argumentos.every((a) => typeof a === 'string')).toBe(true);
    expect(argumentos.join(' ')).not.toContain('contenido-sensible');
    quitar();
  });
});
