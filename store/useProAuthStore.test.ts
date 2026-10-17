import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { proService, type ProSesion } from '@/services/proService';
import { PRO_STORAGE_KEYS } from '@/lib/pro/storageKeys';
import type { ProError } from '@/lib/pro/errores';
import type { ProMe, ProVinculo } from '@/lib/pro/tipos';
import { iniciarEscuchasPro, registrarResetPorNegocio, useProAuthStore } from './useProAuthStore';

// La máquina de estados de la sesión del portal. Los endpoints se espían en
// proService (la red no se toca); el storage de sesión es el REAL (jsdom) para
// que se vea qué queda guardado de verdad.

const AHORA = Date.parse('2026-10-17T12:00:00Z');
const UNA_HORA = 3_600_000;
const EN_UNA_HORA = AHORA + UNA_HORA;
const A_LOS_15_MIN = AHORA + 15 * 60_000;

const store = () => useProAuthStore.getState();
// Varias vueltas de microtareas: inicializar -> cargarMe -> me() -> aplicarMe encadena promesas.
async function flush() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

function vinculo(id: number, extra: Partial<ProVinculo> = {}): ProVinculo {
  return {
    id,
    negocioNombre: `Negocio ${id}`,
    profesional: { nombre: 'Ana', apellido: 'Paz', avatar_url: null },
    disponible: true,
    motivo: null,
    ...extra,
  };
}

const meCon = (vinculos: ProVinculo[], email: string | null = 'ana@correo.com'): ProMe => ({ email, vinculos, descartados: 0 });
const rechazo = (proError: ProError) => Object.assign(new Error('rechazado'), { proError });
const sesion = (tipo: ProSesion['tipo'], extra: Partial<ProSesion> = {}): ProSesion => ({
  token: 'tok-nuevo',
  tipo,
  expiresAt: EN_UNA_HORA,
  ...extra,
});

function guardarSesionPrevia(tipo: ProSesion['tipo'], expiresAt = EN_UNA_HORA, token = 'tok-previo') {
  expect(proService.guardarSesion({ token, tipo, expiresAt })).toBe(true);
}

const enStorage = (clave: string) => localStorage.getItem(clave);
const hayRastroDeSesion = () =>
  [PRO_STORAGE_KEYS.token, PRO_STORAGE_KEYS.tipo, PRO_STORAGE_KEYS.expiresAt].some((c) => enStorage(c) !== null);

let me: MockInstance<typeof proService.me>;
let logoutRemoto: MockInstance<typeof proService.logout>;
let resets: Mock<() => void>;
let quitarReset: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
  localStorage.clear();
  useProAuthStore.setState(useProAuthStore.getInitialState(), true);
  me = vi.spyOn(proService, 'me').mockResolvedValue(meCon([vinculo(1)]));
  logoutRemoto = vi.spyOn(proService, 'logout').mockResolvedValue(undefined);
  resets = vi.fn();
  quitarReset = registrarResetPorNegocio(resets);
});

afterEach(() => {
  quitarReset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('inicializar — arranque desde el storage', () => {
  it('arranca en booting hasta que se lee el storage', () => {
    expect(store().status).toBe('booting');
  });

  it('sin sesión guardada queda anonymous y no pide nada a la red', () => {
    store().inicializar();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBeNull();
    expect(me).not.toHaveBeenCalled();
  });

  it('un token restringido vigente restaura el cambio de contraseña forzado SIN llamar a `me` (SE-4 S1)', () => {
    guardarSesionPrevia('restricted', A_LOS_15_MIN);

    store().inicializar();

    expect(store().status).toBe('restricted');
    expect(me).not.toHaveBeenCalled();
  });

  it('un token completo vigente pasa por loadingMe y termina full con los vínculos de `me`', async () => {
    guardarSesionPrevia('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));

    store().inicializar();
    expect(store().status).toBe('loadingMe');
    await flush();

    expect(store().status).toBe('full');
    expect(store().email).toBe('ana@correo.com');
    expect(store().vinculos.map((v) => v.id)).toEqual([1, 2]);
  });

  it('un token vencido se borra, queda anonymous con aviso `expired` y no hay red (SE-4 S2)', () => {
    guardarSesionPrevia('full', AHORA - 1000);

    store().inicializar();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
    expect(hayRastroDeSesion()).toBe(false);
    expect(me).not.toHaveBeenCalled();
  });

  it('un token sin vencimiento guardado se trata como sin sesión, sin aviso (SE-4 S3/S5)', () => {
    localStorage.setItem(PRO_STORAGE_KEYS.token, 'tok');
    localStorage.setItem(PRO_STORAGE_KEYS.tipo, 'full');

    store().inicializar();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBeNull();
    expect(hayRastroDeSesion()).toBe(false);
    expect(me).not.toHaveBeenCalled();
  });

  it('llamarlo dos veces seguidas (StrictMode) pide `me` una sola vez', async () => {
    guardarSesionPrevia('full');

    store().inicializar();
    store().inicializar();
    await flush();

    expect(me).toHaveBeenCalledTimes(1);
  });
});

describe('cargarMe — elección inicial del negocio', () => {
  async function cargar(vinculos: ProVinculo[]) {
    guardarSesionPrevia('full');
    me.mockResolvedValue(meCon(vinculos));
    store().inicializar();
    await flush();
  }

  it('con un único vínculo lo elige solo, aunque esté no disponible (para mostrar su pantalla de estado)', async () => {
    await cargar([vinculo(7, { disponible: false, motivo: 'SUBSCRIPTION_SUSPENDED' })]);
    expect(store().vinculoActivoId).toBe(7);
  });

  it('con varios usa el último negocio si sigue listado y disponible', async () => {
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '2');
    await cargar([vinculo(1), vinculo(2), vinculo(3)]);
    expect(store().vinculoActivoId).toBe(2);
  });

  it('con varios y el último negocio ya no disponible, deja la elección pendiente (SE-9 S6)', async () => {
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '2');
    await cargar([vinculo(1), vinculo(2, { disponible: false, motivo: 'NO_SUBSCRIPTION' })]);
    expect(store().vinculoActivoId).toBeNull();
  });

  it('con varios y el último negocio que ya no figura, deja la elección pendiente', async () => {
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '99');
    await cargar([vinculo(1), vinculo(2)]);
    expect(store().vinculoActivoId).toBeNull();
  });

  it('con varios y sin último negocio, deja la elección pendiente', async () => {
    await cargar([vinculo(1), vinculo(2)]);
    expect(store().vinculoActivoId).toBeNull();
  });

  it('un valor corrupto en pro_ultimo_vinculo se ignora', async () => {
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '2abc');
    await cargar([vinculo(1), vinculo(2)]);
    expect(store().vinculoActivoId).toBeNull();
  });

  it('una nueva carga de `me` conserva el negocio activo mientras siga disponible y no reinicia los datos', async () => {
    await cargar([vinculo(1), vinculo(2)]);
    store().elegirVinculo(2);
    resets.mockClear();

    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    await store().cargarMe();

    expect(store().vinculoActivoId).toBe(2);
    expect(resets).not.toHaveBeenCalled();
  });

  it('si el negocio activo desaparece de `me`, se reinician los datos y se vuelve a elegir', async () => {
    await cargar([vinculo(1), vinculo(2)]);
    store().elegirVinculo(2);
    resets.mockClear();

    me.mockResolvedValue(meCon([vinculo(1), vinculo(3)]));
    await store().cargarMe();

    expect(store().vinculoActivoId).toBeNull();
    expect(resets).toHaveBeenCalledTimes(1);
  });
});

describe('cargarMe — errores', () => {
  beforeEach(() => guardarSesionPrevia('full'));

  it('404 (portalUnavailable) deja el portal no disponible SIN cerrar la sesión guardada', async () => {
    me.mockRejectedValue(rechazo({ kind: 'portalUnavailable' }));

    store().inicializar();
    await flush();

    expect(store().status).toBe('portalUnavailable');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('un error de red al arrancar no cierra la sesión: queda no disponible para reintentar', async () => {
    me.mockRejectedValue(rechazo({ kind: 'network' }));

    store().inicializar();
    await flush();

    expect(store().status).toBe('portalUnavailable');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('un error raro sin clasificar (server) tampoco cierra la sesión', async () => {
    me.mockRejectedValue(new Error('boom'));

    store().inicializar();
    await flush();

    expect(store().status).toBe('portalUnavailable');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('403 de cambio de contraseña pendiente pasa a restricted y lo persiste (SE-9 S7)', async () => {
    me.mockRejectedValue(rechazo({ kind: 'mustChangePassword' }));

    store().inicializar();
    await flush();

    expect(store().status).toBe('restricted');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('restricted');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('401 de sesión revocada cierra la sesión con aviso `revoked`', async () => {
    me.mockRejectedValue(rechazo({ kind: 'sessionRevoked' }));

    store().inicializar();
    await flush();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('revoked');
    expect(hayRastroDeSesion()).toBe(false);
  });

  it('un `me` que responde después de un logout se descarta', async () => {
    let responder: (m: ProMe) => void = () => undefined;
    me.mockReturnValue(new Promise<ProMe>((resolve) => (responder = resolve)));

    store().inicializar();
    const saliendo = store().logout();
    await saliendo;
    responder(meCon([vinculo(1)]));
    await flush();

    expect(store().status).toBe('anonymous');
    expect(store().vinculos).toEqual([]);
  });

  it('reintentar desde portalUnavailable vuelve a leer el storage y a pedir `me`', async () => {
    me.mockRejectedValueOnce(rechazo({ kind: 'network' }));
    store().inicializar();
    await flush();
    expect(store().status).toBe('portalUnavailable');

    store().inicializar();
    await flush();

    expect(store().status).toBe('full');
    expect(me).toHaveBeenCalledTimes(2);
  });

  it('reintentar sin sesión guardada vuelve a anonymous', () => {
    localStorage.clear();
    useProAuthStore.setState({ status: 'portalUnavailable' });

    store().inicializar();

    expect(store().status).toBe('anonymous');
  });
});

describe('login', () => {
  let login: MockInstance<typeof proService.login>;
  beforeEach(() => {
    login = vi.spyOn(proService, 'login');
    store().inicializar();
  });

  it('una sesión completa se guarda, pide `me` y termina full', async () => {
    login.mockResolvedValue(sesion('full'));

    const error = await store().login('ana@correo.com', 'clave-larga-1');

    expect(error).toBeNull();
    expect(login).toHaveBeenCalledWith('ana@correo.com', 'clave-larga-1');
    expect(store().status).toBe('full');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-nuevo');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('full');
    expect(enStorage(PRO_STORAGE_KEYS.expiresAt)).toBe(String(EN_UNA_HORA));
  });

  it('una sesión restringida se guarda como tal y NO pide `me` (el token restringido recibe 403)', async () => {
    login.mockResolvedValue(sesion('restricted', { expiresAt: A_LOS_15_MIN }));

    const error = await store().login('ana@correo.com', 'clave-larga-1');

    expect(error).toBeNull();
    expect(store().status).toBe('restricted');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('restricted');
    expect(me).not.toHaveBeenCalled();
  });

  it('un login exitoso borra el aviso de la pantalla de ingreso', async () => {
    useProAuthStore.setState({ aviso: 'expired' });
    login.mockResolvedValue(sesion('full'));

    await store().login('ana@correo.com', 'clave-larga-1');

    expect(store().aviso).toBeNull();
  });

  it('un login exitoso reinicia los datos por negocio (puede ser otra cuenta)', async () => {
    login.mockResolvedValue(sesion('full'));

    await store().login('ana@correo.com', 'clave-larga-1');

    expect(resets).toHaveBeenCalled();
  });

  it.each<ProError>([
    { kind: 'invalidCredentials' },
    { kind: 'rateLimited', retryAfterSec: 90, lockout: true },
    { kind: 'network' },
    { kind: 'portalUnavailable' },
  ])('el error $kind se devuelve tal cual y no deja sesión', async (proError) => {
    login.mockRejectedValue(rechazo(proError));

    const error = await store().login('ana@correo.com', 'mala');

    expect(error).toEqual(proError);
    expect(store().status).toBe('anonymous');
    expect(hayRastroDeSesion()).toBe(false);
  });

  it('si no se puede guardar la sesión, el login falla cerrado', async () => {
    login.mockResolvedValue(sesion('full'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    const error = await store().login('ana@correo.com', 'clave-larga-1');

    expect(error).toEqual({ kind: 'server' });
    expect(store().status).toBe('anonymous');
    expect(me).not.toHaveBeenCalled();
  });

  it('una sesión sin vencimiento legible no se inicia: no se podría restaurar ni sincronizar (SE-4 S5)', async () => {
    login.mockResolvedValue(sesion('full', { expiresAt: null }));

    const error = await store().login('ana@correo.com', 'clave-larga-1');

    expect(error).toEqual({ kind: 'server' });
    expect(store().status).toBe('anonymous');
    expect(hayRastroDeSesion()).toBe(false);
  });
});

describe('cambiarPassword', () => {
  let cambiar: MockInstance<typeof proService.cambiarPassword>;
  beforeEach(() => {
    cambiar = vi.spyOn(proService, 'cambiarPassword');
    guardarSesionPrevia('restricted', A_LOS_15_MIN);
    store().inicializar();
  });

  it('el token completo reemplaza al restringido y se carga `me` (SE-7 S1)', async () => {
    cambiar.mockResolvedValue(sesion('full'));

    const error = await store().cambiarPassword('clave-larga-2', 'clave-larga-2');

    expect(error).toBeNull();
    expect(cambiar).toHaveBeenCalledWith('clave-larga-2', 'clave-larga-2');
    expect(store().status).toBe('full');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-nuevo');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('full');
  });

  it('un 422 de validación se devuelve y la sesión sigue restringida', async () => {
    const validacion: ProError = { kind: 'validation', fields: { password: ['igual'] } };
    cambiar.mockRejectedValue(rechazo(validacion));

    const error = await store().cambiarPassword('clave-larga-2', 'clave-larga-2');

    expect(error).toEqual(validacion);
    expect(store().status).toBe('restricted');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('403 PASSWORD_CAMBIO_NO_REQUERIDO pasa al flujo normal con la misma sesión (SE-7 S4)', async () => {
    cambiar.mockRejectedValue(rechazo({ kind: 'changeNotRequired' }));

    const error = await store().cambiarPassword('clave-larga-2', 'clave-larga-2');

    expect(error).toBeNull();
    expect(store().status).toBe('full');
    expect(enStorage(PRO_STORAGE_KEYS.tipo)).toBe('full');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('una respuesta que llega después de cerrar sesión no inicia ninguna sesión', async () => {
    let responder: (s: ProSesion) => void = () => undefined;
    cambiar.mockReturnValue(new Promise<ProSesion>((resolve) => (responder = resolve)));

    const pendiente = store().cambiarPassword('clave-larga-2', 'clave-larga-2');
    await store().logout();
    responder(sesion('full'));
    const error = await pendiente;

    expect(error).toEqual({ kind: 'sessionRevoked' });
    expect(store().status).toBe('anonymous');
    expect(hayRastroDeSesion()).toBe(false);
  });
});

describe('elegirVinculo', () => {
  beforeEach(async () => {
    guardarSesionPrevia('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2), vinculo(3, { disponible: false, motivo: 'NO_SUBSCRIPTION' })]));
    store().inicializar();
    await flush();
  });

  it('fija el negocio activo y lo guarda como default del próximo arranque', () => {
    store().elegirVinculo(2);

    expect(store().vinculoActivoId).toBe(2);
    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBe('2');
  });

  it('cambiar de negocio reinicia TODOS los datos por negocio', () => {
    store().elegirVinculo(1);
    resets.mockClear();

    store().elegirVinculo(2);

    expect(resets).toHaveBeenCalledTimes(1);
  });

  it('elegir el que ya está activo no reinicia nada', () => {
    store().elegirVinculo(1);
    resets.mockClear();

    store().elegirVinculo(1);

    expect(resets).not.toHaveBeenCalled();
  });

  it('un id que `me` no lista se ignora', () => {
    store().elegirVinculo(99);

    expect(store().vinculoActivoId).toBeNull();
    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBeNull();
  });

  it('un negocio no disponible no se puede elegir', () => {
    store().elegirVinculo(3);
    expect(store().vinculoActivoId).toBeNull();
  });

  it('un negocio bloqueado en una llamada de datos tampoco', () => {
    store().marcarBloqueo(2, 'disabled');
    store().elegirVinculo(2);
    expect(store().vinculoActivoId).toBeNull();
  });

  it('un reset que falla no impide que corran los demás', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    quitarReset();
    const quitarRoto = registrarResetPorNegocio(() => {
      throw new Error('reset roto');
    });
    const quitarSano = registrarResetPorNegocio(resets);
    resets.mockClear();

    store().elegirVinculo(1);

    expect(resets).toHaveBeenCalledTimes(1);
    quitarRoto();
    quitarSano();
    quitarReset = () => undefined;
  });

  it('un reset dado de baja deja de correr', () => {
    store().elegirVinculo(1);
    resets.mockClear();
    quitarReset();

    store().elegirVinculo(2);

    expect(resets).not.toHaveBeenCalled();
  });
});

describe('marcarBloqueo', () => {
  beforeEach(async () => {
    guardarSesionPrevia('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    store().inicializar();
    await flush();
  });

  it('registra el bloqueo de un negocio listado con su motivo', () => {
    store().marcarBloqueo(1, 'noService', 'SUBSCRIPTION_EXPIRED');
    expect(store().bloqueos).toEqual({ 1: { estado: 'noService', motivo: 'SUBSCRIPTION_EXPIRED' } });
  });

  it('sin motivo queda en null', () => {
    store().marcarBloqueo(2, 'disabled');
    expect(store().bloqueos).toEqual({ 2: { estado: 'disabled', motivo: null } });
  });

  it('un negocio que no figura en `me` se ignora', () => {
    store().marcarBloqueo(99, 'disabled');
    expect(store().bloqueos).toEqual({});
  });
});

describe('expirar y logout — limpieza completa', () => {
  async function conSesionCompleta() {
    guardarSesionPrevia('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    store().inicializar();
    await flush();
    store().elegirVinculo(2);
    resets.mockClear();
  }

  it('expirar borra token, tipo, vencimiento y estado, y reinicia los datos por negocio', async () => {
    await conSesionCompleta();

    store().expirar('revoked');

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('revoked');
    expect(store().token).toBeNull();
    expect(store().vinculos).toEqual([]);
    expect(store().vinculoActivoId).toBeNull();
    expect(hayRastroDeSesion()).toBe(false);
    expect(resets).toHaveBeenCalledTimes(1);
  });

  it('muchos 401 en paralelo son una sola transición (idempotente)', async () => {
    await conSesionCompleta();

    store().expirar('revoked');
    store().expirar('revoked');
    store().expirar('expired');
    store().expirar('revoked');

    expect(resets).toHaveBeenCalledTimes(1);
    expect(store().aviso).toBe('revoked');
  });

  it('un 401 tardío sobre una pantalla de ingreso ya limpia no inventa un aviso', () => {
    store().inicializar();

    store().expirar('revoked');

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBeNull();
    expect(resets).not.toHaveBeenCalled();
  });

  it('la limpieza no toca las keys del tenant ni del admin ni emite eventos', async () => {
    await conSesionCompleta();
    localStorage.setItem('auth_token', 'tenant');
    localStorage.setItem('auth_user', '{"id":1}');
    localStorage.setItem('admin_token', 'admin');
    const emitir = vi.spyOn(window, 'dispatchEvent');

    store().expirar('revoked');
    await store().logout();

    expect(localStorage.getItem('auth_token')).toBe('tenant');
    expect(localStorage.getItem('auth_user')).toBe('{"id":1}');
    expect(localStorage.getItem('admin_token')).toBe('admin');
    expect(emitir).not.toHaveBeenCalled();
  });

  it('expirar y logout descartan el último negocio: la próxima cuenta no hereda el default', async () => {
    await conSesionCompleta();

    store().expirar('expired');
    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBeNull();

    useProAuthStore.setState(useProAuthStore.getInitialState(), true);
    await conSesionCompleta();
    await store().logout();
    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBeNull();
  });

  it('logout avisa al backend ANTES de borrar el token y deja todo limpio (SE-12 S1)', async () => {
    await conSesionCompleta();
    let tokenAlAvisar: string | null = null;
    logoutRemoto.mockImplementation(async () => {
      tokenAlAvisar = enStorage(PRO_STORAGE_KEYS.token);
    });

    await store().logout();

    expect(tokenAlAvisar).toBe('tok-previo');
    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBeNull();
    expect(hayRastroDeSesion()).toBe(false);
    expect(resets).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['red', rechazo({ kind: 'network' })],
    ['401', rechazo({ kind: 'sessionRevoked' })],
    ['error sin clasificar', new Error('boom')],
  ])('logout limpia todo aunque el POST falle (%s)', async (_nombre, fallo) => {
    await conSesionCompleta();
    logoutRemoto.mockRejectedValue(fallo);

    await store().logout();

    expect(store().status).toBe('anonymous');
    expect(hayRastroDeSesion()).toBe(false);
    expect(enStorage(PRO_STORAGE_KEYS.ultimoVinculo)).toBeNull();
  });

  it('un 401 que llega mientras se cierra sesión no deja el aviso `revoked` en un logout voluntario', async () => {
    await conSesionCompleta();
    logoutRemoto.mockImplementation(async () => {
      store().expirar('revoked');
      throw rechazo({ kind: 'sessionRevoked' });
    });

    await store().logout();

    expect(store().aviso).toBeNull();
  });

  it('dos logout seguidos mandan un solo POST', async () => {
    await conSesionCompleta();

    await Promise.all([store().logout(), store().logout()]);

    expect(logoutRemoto).toHaveBeenCalledTimes(1);
  });

  it('logout sin sesión no llama al backend', async () => {
    store().inicializar();

    await store().logout();

    expect(logoutRemoto).not.toHaveBeenCalled();
    expect(store().status).toBe('anonymous');
  });
});

describe('revisarExpiracion', () => {
  it('con la sesión vigente no hace nada', async () => {
    guardarSesionPrevia('full');
    store().inicializar();
    await flush();

    vi.setSystemTime(EN_UNA_HORA - 1);
    store().revisarExpiracion();

    expect(store().status).toBe('full');
  });

  it('con la sesión vencida mientras la pantalla seguía abierta la cierra con aviso `expired` (SE-4 S4)', async () => {
    guardarSesionPrevia('full');
    store().inicializar();
    await flush();

    vi.setSystemTime(EN_UNA_HORA);
    store().revisarExpiracion();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
    expect(hayRastroDeSesion()).toBe(false);
  });

  it('un token restringido de 15 minutos que vence en pantalla lleva al ingreso con aviso', () => {
    guardarSesionPrevia('restricted', A_LOS_15_MIN);
    store().inicializar();

    vi.setSystemTime(A_LOS_15_MIN + 1000);
    store().revisarExpiracion();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
  });

  it('sin sesión (anonymous) no hace nada', () => {
    store().inicializar();
    vi.setSystemTime(EN_UNA_HORA + UNA_HORA);

    store().revisarExpiracion();

    expect(store().aviso).toBeNull();
  });

  it('también cierra si el portal estaba no disponible con una sesión ya vencida', async () => {
    guardarSesionPrevia('full');
    store().inicializar();
    await flush();
    store().marcarPortalNoDisponible();

    vi.setSystemTime(EN_UNA_HORA + 1);
    store().revisarExpiracion();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
  });
});

describe('sincronizarDesdeStorage — otra pestaña', () => {
  async function conSesionCompleta() {
    guardarSesionPrevia('full');
    store().inicializar();
    await flush();
    resets.mockClear();
    me.mockClear();
  }

  it('si la otra pestaña cerró sesión (el token ya no está), esta pasa a anonymous sin aviso', async () => {
    await conSesionCompleta();
    localStorage.clear();

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBeNull();
    expect(resets).toHaveBeenCalledTimes(1);
  });

  it('si la sesión guardada venció, pasa a anonymous con aviso `expired`', async () => {
    await conSesionCompleta();
    guardarSesionPrevia('full', AHORA + 1000);
    vi.setSystemTime(AHORA + 2000);

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
  });

  it('si la otra pestaña inició sesión, esta la adopta y carga `me`', async () => {
    store().inicializar();
    expect(store().status).toBe('anonymous');
    guardarSesionPrevia('full', EN_UNA_HORA, 'tok-otra-pestana');

    store().sincronizarDesdeStorage();
    await flush();

    expect(store().status).toBe('full');
    expect(store().token).toBe('tok-otra-pestana');
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('si la otra pestaña inició una sesión restringida, esta pasa a restricted', () => {
    store().inicializar();
    guardarSesionPrevia('restricted', A_LOS_15_MIN, 'tok-r');

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('restricted');
    expect(me).not.toHaveBeenCalled();
  });

  it('si el token cambió (otra cuenta), reinicia los datos y recarga `me`', async () => {
    await conSesionCompleta();
    guardarSesionPrevia('full', EN_UNA_HORA + UNA_HORA, 'tok-de-otra-cuenta');

    store().sincronizarDesdeStorage();
    await flush();

    expect(store().token).toBe('tok-de-otra-cuenta');
    expect(resets).toHaveBeenCalledTimes(1);
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('si la sesión es la misma, no toca nada (no pisa lo que el usuario está viendo)', async () => {
    await conSesionCompleta();

    store().sincronizarDesdeStorage();
    await flush();

    expect(resets).not.toHaveBeenCalled();
    expect(me).not.toHaveBeenCalled();
    expect(store().status).toBe('full');
  });

  it('si la misma sesión pasó de restringida a completa en la otra pestaña, esta sigue a la otra', () => {
    guardarSesionPrevia('restricted', A_LOS_15_MIN, 'tok-r');
    store().inicializar();
    proService.guardarSesion({ token: 'tok-r', tipo: 'full', expiresAt: A_LOS_15_MIN });

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('loadingMe');
  });

  it('anonymous sin nada guardado sigue igual y conserva su aviso', () => {
    store().inicializar();
    useProAuthStore.setState({ aviso: 'revoked' });

    store().sincronizarDesdeStorage();

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('revoked');
  });

  it('no cambia el negocio activo de esta pestaña por lo que haga otra (D12)', async () => {
    guardarSesionPrevia('full');
    me.mockResolvedValue(meCon([vinculo(1), vinculo(2)]));
    store().inicializar();
    await flush();
    store().elegirVinculo(1);
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, '2');

    store().sincronizarDesdeStorage();

    expect(store().vinculoActivoId).toBe(1);
  });
});

describe('marcarPortalNoDisponible', () => {
  it('cambia de pantalla pero conserva la sesión guardada', async () => {
    guardarSesionPrevia('full');
    store().inicializar();
    await flush();

    store().marcarPortalNoDisponible();

    expect(store().status).toBe('portalUnavailable');
    expect(enStorage(PRO_STORAGE_KEYS.token)).toBe('tok-previo');
  });

  it('también aplica sin sesión (un 404 en el login)', () => {
    store().inicializar();

    store().marcarPortalNoDisponible();

    expect(store().status).toBe('portalUnavailable');
  });
});

describe('iniciarEscuchasPro — eventos del navegador', () => {
  let quitarEscuchas: () => void;
  beforeEach(() => {
    quitarEscuchas = iniciarEscuchasPro();
  });
  afterEach(() => quitarEscuchas());

  const emitir = (nombre: string) => window.dispatchEvent(new CustomEvent(nombre));
  const eventoStorage = (key: string | null) => window.dispatchEvent(new StorageEvent('storage', { key }));

  async function conSesionCompleta() {
    guardarSesionPrevia('full');
    store().inicializar();
    await flush();
  }

  it('pro-session-expired cierra la sesión con aviso `revoked`; varios seguidos son una sola transición', async () => {
    await conSesionCompleta();
    resets.mockClear();

    emitir('pro-session-expired');
    emitir('pro-session-expired');
    emitir('pro-session-expired');

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('revoked');
    expect(resets).toHaveBeenCalledTimes(1);
  });

  it('pro-portal-unavailable marca el portal como no disponible', async () => {
    await conSesionCompleta();

    emitir('pro-portal-unavailable');

    expect(store().status).toBe('portalUnavailable');
  });

  it('los eventos del tenant y del admin no mueven la sesión del portal', async () => {
    await conSesionCompleta();

    emitir('session-expired');
    emitir('auth-expired');
    emitir('admin-session-expired');

    expect(store().status).toBe('full');
  });

  it.each([PRO_STORAGE_KEYS.token, PRO_STORAGE_KEYS.tipo, PRO_STORAGE_KEYS.expiresAt, null])(
    'un evento storage con key %s relee la sesión',
    async (key) => {
      await conSesionCompleta();
      const sincronizar = vi.fn();
      useProAuthStore.setState({ sincronizarDesdeStorage: sincronizar });

      eventoStorage(key);

      expect(sincronizar).toHaveBeenCalledTimes(1);
    },
  );

  it.each([PRO_STORAGE_KEYS.ultimoVinculo, 'auth_token', 'admin_token', 'locale'])(
    'un evento storage con key %s se ignora',
    async (key) => {
      await conSesionCompleta();
      const sincronizar = vi.fn();
      useProAuthStore.setState({ sincronizarDesdeStorage: sincronizar });

      eventoStorage(key);

      expect(sincronizar).not.toHaveBeenCalled();
    },
  );

  it('en la práctica: logout en otra pestaña (clear) lleva a esta al ingreso', async () => {
    await conSesionCompleta();
    localStorage.clear();

    eventoStorage(null);

    expect(store().status).toBe('anonymous');
  });

  it('al volver la pestaña a visible revisa el vencimiento y vuelve a leer el storage', async () => {
    await conSesionCompleta();
    const revisar = vi.fn();
    const sincronizar = vi.fn();
    useProAuthStore.setState({ revisarExpiracion: revisar, sincronizarDesdeStorage: sincronizar });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(revisar).toHaveBeenCalledTimes(1);
    expect(sincronizar).toHaveBeenCalledTimes(1);
  });

  it('al ocultarse la pestaña no revisa nada', async () => {
    await conSesionCompleta();
    const revisar = vi.fn();
    useProAuthStore.setState({ revisarExpiracion: revisar });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(revisar).not.toHaveBeenCalled();
  });

  it('la sesión vencida con la pestaña en segundo plano se cierra apenas vuelve a verse', async () => {
    await conSesionCompleta();
    vi.setSystemTime(EN_UNA_HORA + 1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(store().status).toBe('anonymous');
    expect(store().aviso).toBe('expired');
  });

  it('al dar de baja las escuchas, los eventos dejan de tener efecto', async () => {
    await conSesionCompleta();
    quitarEscuchas();

    emitir('pro-session-expired');
    eventoStorage(null);

    expect(store().status).toBe('full');
  });
});
