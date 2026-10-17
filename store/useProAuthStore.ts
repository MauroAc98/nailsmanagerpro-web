import { create } from 'zustand';
import { isAxiosError } from 'axios';
import { proService, type ProSesion } from '@/services/proService';
import { proErrorDe } from '@/lib/proApi';
import { type BloqueoVinculo, type BloqueosVinculo } from '@/lib/pro/acceso';
import type { MotivoVinculo, ProError } from '@/lib/pro/errores';
import type { ProAuthStatus } from '@/lib/pro/resolveProRoute';
import { PRO_STORAGE_KEYS, esClaveSesionPro } from '@/lib/pro/storageKeys';
import type { ProMe, ProVinculo } from '@/lib/pro/tipos';

// Sesión del portal de profesionales. Store completamente separado de
// useAuthStore (tenant) y de useAdminAuthStore: no importa ningún módulo del
// salón, no escucha ni emite eventos del tenant y no toca sus keys de storage.
// La sesión del portal y la del salón conviven en el mismo navegador sin verse.
//
// Máquina de estados (`status`):
//   booting           -> todavía no se leyó el storage (primer render / SSR)
//   anonymous         -> sin sesión (con `aviso` si se cerró sola: vencida / revocada)
//   restricted        -> token de cambio de contraseña forzado; NUNCA se deriva de
//                        `me` (un token restringido recibe 403 ahí): viaja guardado
//   loadingMe         -> sesión completa, esperando `me`
//   full              -> sesión completa con `me` cargado
//   portalUnavailable -> 404 del portal o `me` que no se pudo cargar; NO cierra la
//                        sesión: es una pantalla con reintento
//
// DATOS POR NEGOCIO (P8+): cada slice (stores, cachés, hooks de datos) debe
// descartar las respuestas tardías. Dos defensas, usar al menos una:
//  - pedir con el vínculo explícito y, al volver, comparar con
//    `vinculoActivoId` actual (las claves de caché llevan `${vinculoId}:`);
//  - guardar `epochNegocio` al pedir y descartar si cambió (sube en cada
//    reinicio: cambio de negocio, de cuenta, cierre de sesión).
// Además cada slice registra su reset con registrarResetPorNegocio.
//
// Los estados por negocio (deshabilitado / sin servicio / elegir) no son
// `status`: salen de lib/pro/acceso.ts a partir de vinculos + bloqueos.

export type { ProAuthStatus };

// Por qué se volvió al ingreso sin que la persona lo pidiera.
export type AvisoLogin = 'expired' | 'revoked' | null;

interface ProAuthState {
  status: ProAuthStatus;
  aviso: AvisoLogin;
  // Copia en memoria de lo que hay en storage: sirve para detectar que otra
  // pestaña cambió de sesión y para chequear el vencimiento sin releer.
  token: string | null;
  expiresAt: number | null;
  email: string | null;
  vinculos: ProVinculo[];
  vinculoActivoId: number | null;
  // Bloqueos detectados en llamadas de datos (los que `me` ya informó salen de
  // `disponible`/`motivo`; ver bloqueoEfectivo).
  bloqueos: BloqueosVinculo;
  // Sube con cada reinicio de los datos por negocio (cambio de negocio, de
  // cuenta, cierre de sesión). Un slice de datos guarda el valor al pedir y
  // descarta la respuesta si cambió (ver el encabezado de abajo).
  epochNegocio: number;

  // Arranque y reintento: lee el storage (síncrono). Solo actúa desde booting o
  // portalUnavailable, así que llamarlo dos veces (StrictMode) es inofensivo.
  inicializar: () => void;
  // Devuelven null si la sesión quedó iniciada o el ProError a mostrar.
  login: (email: string, password: string) => Promise<ProError | null>;
  cambiarPassword: (password: string, confirmacion: string) => Promise<ProError | null>;
  cargarMe: () => Promise<void>;
  elegirVinculo: (id: number) => void;
  marcarBloqueo: (id: number, estado: BloqueoVinculo['estado'], motivo?: MotivoVinculo | null) => void;
  // Cierre automático (401, vencimiento, otra pestaña). Idempotente.
  expirar: (aviso: AvisoLogin) => void;
  // Cierre voluntario: avisa al backend (best-effort) y limpia SIEMPRE.
  logout: () => Promise<void>;
  revisarExpiracion: () => void;
  sincronizarDesdeStorage: () => void;
  marcarPortalNoDisponible: () => void;
}

const SIN_SESION = {
  token: null,
  expiresAt: null,
  email: null,
  vinculos: [] as ProVinculo[],
  vinculoActivoId: null,
  bloqueos: {} as BloqueosVinculo,
};

function tokenEnStorage(): string | null {
  try {
    return localStorage.getItem(PRO_STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

function hayOtroTokenEnStorage(): boolean {
  const guardado = tokenEnStorage();
  return guardado !== null && guardado !== useProAuthStore.getState().token;
}

// ── Estado de módulo ────────────────────────────────────────────────────────

// Sube en cada cambio de sesión (cierre, login, adopción): una respuesta de red
// que vuelve después de un cambio compara su generación y se descarta, así un
// `me` o un cambio de contraseña tardío no resucita una sesión cerrada.
let generacion = 0;
let meEnVuelo: { gen: number; promesa: Promise<void> } | null = null;
let logoutEnCurso: Promise<void> | null = null;
let loginEnCurso: Promise<ProError | null> | null = null;

// Datos y cachés por negocio de los slices de agenda (stores, LRUs): cada uno se
// registra acá y se vacían TODOS al cambiar de negocio, de cuenta o al cerrar
// sesión. Es el mecanismo que impide que se vea un turno de otro negocio.
const resetsPorNegocio = new Set<() => void>();

export function registrarResetPorNegocio(reset: () => void): () => void {
  resetsPorNegocio.add(reset);
  return () => {
    resetsPorNegocio.delete(reset);
  };
}

function ejecutarResets(): void {
  useProAuthStore.setState((s) => ({ epochNegocio: s.epochNegocio + 1 }));
  for (const reset of [...resetsPorNegocio]) {
    try {
      reset();
    } catch {
      // Un reset roto no debe impedir que los demás limpien sus datos. Texto
      // fijo a propósito: el error lo arma el slice y podría llevar datos del
      // negocio (nombres, turnos) a la consola.
      console.error('[pro] reset por negocio fallido');
    }
  }
}

// ── pro_ultimo_vinculo: default del próximo arranque, NO es parte de la sesión ─

function leerUltimoVinculo(): number | null {
  try {
    const crudo = localStorage.getItem(PRO_STORAGE_KEYS.ultimoVinculo);
    return crudo !== null && /^[1-9]\d{0,14}$/.test(crudo) ? Number(crudo) : null;
  } catch {
    return null;
  }
}

function guardarUltimoVinculo(id: number): void {
  try {
    localStorage.setItem(PRO_STORAGE_KEYS.ultimoVinculo, String(id));
  } catch {
    // sin storage: la elección vale solo para esta pestaña
  }
}

function borrarUltimoVinculo(): void {
  try {
    localStorage.removeItem(PRO_STORAGE_KEYS.ultimoVinculo);
  } catch {
    // sin acceso a localStorage — no hay nada que borrar
  }
}

// ── Transiciones ────────────────────────────────────────────────────────────

// Limpieza única de toda salida de sesión: storage de sesión, datos por negocio
// y estado en memoria. No toca ninguna key del tenant o del admin.
//
// `borrarStorage: false` es para la salida por sincronización con otra pestaña:
// ahí el storage lo maneja la otra pestaña (puede estar escribiendo una sesión
// nueva key por key) y esta solo actualiza su memoria.
function limpiarSesion(aviso: AvisoLogin, borrarStorage = true): void {
  generacion += 1;
  if (borrarStorage) proService.borrarSesion();
  // pro_ultimo_vinculo es el default del próximo ARRANQUE de esta persona: al
  // terminar la sesión por cualquier vía (logout, 401, vencimiento, otra
  // pestaña) se descarta, así una cuenta distinta no hereda el negocio.
  borrarUltimoVinculo();
  ejecutarResets();
  useProAuthStore.setState({ status: 'anonymous', aviso, ...SIN_SESION });
}

type SesionConVencimiento = ProSesion & { expiresAt: number };

// Toma una sesión nueva (login, cambio de contraseña, otra pestaña). Los datos
// de la anterior se descartan: puede ser otra cuenta.
async function adoptarSesion(sesion: SesionConVencimiento): Promise<void> {
  generacion += 1;
  ejecutarResets();
  useProAuthStore.setState({
    ...SIN_SESION,
    token: sesion.token,
    expiresAt: sesion.expiresAt,
    aviso: null,
    status: sesion.tipo === 'restricted' ? 'restricted' : 'loadingMe',
  });
  if (sesion.tipo === 'full') await useProAuthStore.getState().cargarMe();
}

// Una sesión sin vencimiento legible no se inicia (falla cerrado, SE-4 S5): no
// se podría restaurar al recargar ni sincronizar entre pestañas. El backend
// siempre manda `expires_at`, así que esto solo corta un contrato roto.
async function iniciarSesion(sesion: ProSesion): Promise<ProError | null> {
  if (sesion.expiresAt === null) return { kind: 'server' };
  // Si el storage no se pudo escribir, proApi (que lee el token de ahí) no
  // podría usar la sesión: no se da por iniciada.
  if (!proService.guardarSesion(sesion)) return { kind: 'server' };
  await adoptarSesion({ ...sesion, expiresAt: sesion.expiresAt });
  return null;
}

// El backend dice que la cuenta tiene que cambiar la contraseña aunque el
// token guardado figuraba como completo: se persiste como restringido para que
// sobreviva a una recarga.
function pasarARestringida(): void {
  const lectura = proService.peekSesion();
  if (lectura.estado !== 'vigente' || !proService.guardarSesion({ ...lectura.sesion, tipo: 'restricted' })) {
    limpiarSesion(null);
    return;
  }
  generacion += 1;
  ejecutarResets();
  useProAuthStore.setState({
    ...SIN_SESION,
    token: lectura.sesion.token,
    expiresAt: lectura.sesion.expiresAt,
    status: 'restricted',
  });
}

// El backend dice que el cambio de contraseña no hace falta: el token es
// completo y sigue el flujo normal con la misma sesión.
async function pasarACompleta(): Promise<ProError | null> {
  const lectura = proService.peekSesion();
  if (lectura.estado !== 'vigente') return { kind: 'sessionRevoked' };
  return iniciarSesion({ ...lectura.sesion, tipo: 'full' });
}

// Un negocio por defecto para quien recién entra:
//  - el que ya estaba activo en esta pestaña, si sigue disponible;
//  - el único vínculo, aunque no esté disponible (para mostrar su pantalla);
//  - el último que se usó, si sigue listado y disponible (SE-9 S6);
//  - ninguno: hay que elegir.
function negocioInicial(vinculos: readonly ProVinculo[], previo: number | null): number | null {
  const previoVigente = vinculos.find((v) => v.id === previo);
  if (previoVigente?.disponible) return previoVigente.id;
  if (vinculos.length === 1) return vinculos[0].id;
  const ultimo = vinculos.find((v) => v.id === leerUltimoVinculo());
  return ultimo?.disponible ? ultimo.id : null;
}

function aplicarMe(datos: ProMe): void {
  const previo = useProAuthStore.getState().vinculoActivoId;
  const activo = negocioInicial(datos.vinculos, previo);
  // Si el negocio activo cambió (ya no figura / dejó de estar disponible), los
  // datos del anterior no pueden quedar a la vista.
  if (previo !== null && previo !== activo) ejecutarResets();
  useProAuthStore.setState({
    status: 'full',
    email: datos.email,
    vinculos: datos.vinculos,
    vinculoActivoId: activo,
    bloqueos: {},
  });
}

function manejarErrorDeMe(error: ProError): void {
  switch (error.kind) {
    case 'sessionRevoked':
      useProAuthStore.getState().expirar('revoked');
      return;
    case 'mustChangePassword':
      pasarARestringida();
      return;
    default:
      // 404, red, 5xx o una respuesta inválida: la sesión puede estar perfecta,
      // así que NO se cierra. Pantalla "no disponible" con reintento.
      useProAuthStore.setState({ status: 'portalUnavailable' });
  }
}

async function cargarMeDe(gen: number): Promise<void> {
  try {
    const datos = await proService.me();
    if (gen === generacion) aplicarMe(datos);
  } catch (error) {
    if (gen !== generacion) return;
    const proError = proErrorDe(error);
    // Un 403 SIN código en `me` es el de habilidades de Sanctum: el token es
    // restringido pero el tipo guardado dice `full` (storage adulterado o
    // inconsistente). Reintentar no lo arregla jamás: se cierra la sesión en
    // vez de dejar un callejón de "Reintentar". Un 5xx real sigue siendo
    // "no disponible" (la sesión puede estar bien).
    if (proError.kind === 'server' && isAxiosError(error) && error.response?.status === 403) {
      limpiarSesion('revoked');
      return;
    }
    manejarErrorDeMe(proError);
  }
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useProAuthStore = create<ProAuthState>((set, get) => ({
  status: 'booting',
  aviso: null,
  epochNegocio: 0,
  ...SIN_SESION,

  inicializar: () => {
    const { status } = get();
    if (status !== 'booting' && status !== 'portalUnavailable') return;

    // Única lectura DESTRUCTIVA: el arranque (y el reintento) limpia datos
    // corruptos o vencidos. El resto del store solo usa peekSesion.
    const lectura = proService.leerSesion();
    if (lectura.estado === 'expirada') {
      limpiarSesion('expired');
    } else if (lectura.estado === 'ninguna') {
      if (get().token !== null) limpiarSesion(null);
      else set({ status: 'anonymous' });
    } else {
      void adoptarSesion(lectura.sesion);
    }
  },

  // Llamadas concurrentes comparten UN request (doble tap, Enter + click).
  login: (email, password) => {
    if (loginEnCurso) return loginEnCurso;
    const promesa: Promise<ProError | null> = (async () => {
      const gen = generacion;
      let sesion: ProSesion;
      try {
        sesion = await proService.login(email, password);
      } catch (error) {
        return proErrorDe(error);
      }
      // Otra pestaña (o un cierre) cambió la sesión mientras viajaba el login:
      // esta respuesta no pisa lo que ya está adoptado. Si ya hay sesión, para el
      // formulario el ingreso está hecho.
      if (gen !== generacion) return get().status === 'anonymous' ? ({ kind: 'sessionRevoked' } as const) : null;
      return iniciarSesion(sesion);
    })().finally(() => {
      loginEnCurso = null;
    });
    loginEnCurso = promesa;
    return promesa;
  },

  cambiarPassword: async (password, confirmacion) => {
    const gen = generacion;
    let sesion: ProSesion;
    try {
      sesion = await proService.cambiarPassword(password, confirmacion);
    } catch (error) {
      if (gen !== generacion) return { kind: 'sessionRevoked' };
      const proError = proErrorDe(error);
      return proError.kind === 'changeNotRequired' ? pasarACompleta() : proError;
    }
    // La sesión cambió mientras viajaba el request (logout, otra pestaña): esta
    // respuesta ya no le corresponde a nadie.
    if (gen !== generacion) return { kind: 'sessionRevoked' };
    return iniciarSesion(sesion);
  },

  cargarMe: () => {
    // Un token restringido recibe 403 en `me`: no se pide.
    if (get().status === 'restricted') return Promise.resolve();
    if (meEnVuelo && meEnVuelo.gen === generacion) return meEnVuelo.promesa;
    const gen = generacion;
    const promesa: Promise<void> = cargarMeDe(gen).finally(() => {
      if (meEnVuelo?.promesa === promesa) meEnVuelo = null;
    });
    meEnVuelo = { gen, promesa };
    return promesa;
  },

  elegirVinculo: (id) => {
    const { vinculos, vinculoActivoId, bloqueos } = get();
    const elegido = vinculos.find((v) => v.id === id);
    // Solo un negocio listado y usable: la lista ya muestra deshabilitados los
    // demás, esto es la defensa por si algo igual llama.
    if (!elegido || !elegido.disponible || bloqueos[id]) return;

    guardarUltimoVinculo(id);
    if (vinculoActivoId === id) return;
    // Primero se vacían los datos del negocio anterior, después se cambia: quien
    // se entere del cambio ya no encuentra nada del otro negocio.
    ejecutarResets();
    set({ vinculoActivoId: id });
  },

  marcarBloqueo: (id, estado, motivo = null) => {
    if (!get().vinculos.some((v) => v.id === id)) return;
    set((s) => ({ bloqueos: { ...s.bloqueos, [id]: { estado, motivo } } }));
  },

  expirar: (aviso) => {
    // Idempotente: varios 401 en paralelo son UNA transición, y un 401 tardío
    // sobre un ingreso ya limpio no inventa un aviso.
    if (get().status === 'anonymous') return;
    limpiarSesion(aviso);
  },

  logout: () => {
    if (logoutEnCurso) return logoutEnCurso;
    const gen = generacion;
    const promesa: Promise<void> = (async () => {
      try {
        // Antes de limpiar: proApi toma el Bearer del storage al enviar.
        if (get().token !== null) await proService.logout();
      } catch {
        // Mejor esfuerzo: sin red o con el token ya muerto igual se cierra acá.
      } finally {
        if (gen === generacion) {
          limpiarSesion(null);
        } else if (get().status === 'anonymous' && get().aviso !== null) {
          // Un 401 de esta misma llamada ya cerró la sesión con aviso 'revoked':
          // el cierre fue voluntario, no corresponde el aviso.
          set({ aviso: null });
        }
        // Si la generación cambió y hay otra sesión (adoptada por sincronización
        // mientras viajaba el POST), NO se toca: no es la que se cerró.
      }
    })().finally(() => {
      logoutEnCurso = null;
    });
    logoutEnCurso = promesa;
    return promesa;
  },

  revisarExpiracion: () => {
    const { status, expiresAt } = get();
    if (status === 'booting' || status === 'anonymous') return;
    if (expiresAt === null || expiresAt > Date.now()) return;
    // Si el storage ya tiene OTRA sesión (otra pestaña inició sesión y su
    // escritura está en curso), no se destruye: se adopta por sincronización.
    const guardado = proService.peekSesion();
    const otraSesion = guardado.estado === 'vigente' && guardado.sesion.token !== get().token;
    if (otraSesion || hayOtroTokenEnStorage()) {
      get().sincronizarDesdeStorage();
      return;
    }
    get().expirar('expired');
  },

  // Otra pestaña cambió la sesión. Se relee SIEMPRE el storage (no event.newValue):
  // login y logout escriben varias keys y al procesar el primer evento ya están
  // todas. NO sigue el negocio activo de la otra pestaña (D12): ese vive en
  // memoria por pestaña.
  sincronizarDesdeStorage: () => {
    // SOLO LECTURA: guardarSesion de otra pestaña escribe token, tipo y
    // vencimiento de a una key (un evento `storage` por cada una), así que un
    // estado a medias es normal. Borrarlo destruiría la sesión que la otra
    // pestaña está creando.
    const lectura = proService.peekSesion();
    const actual = get();
    const tokenGuardado = tokenEnStorage();

    if (lectura.estado === 'vigente') {
      const { token, tipo, expiresAt } = lectura.sesion;
      const tipoActual = actual.status === 'restricted' ? 'restricted' : 'full';
      if (actual.token === token && actual.expiresAt === expiresAt && tipoActual === tipo) return;
      void adoptarSesion(lectura.sesion);
      return;
    }

    if (actual.token === null) return;

    // El token ya no está (logout o clear() en otra pestaña): cierre genuino. Sin
    // tocar el storage, que ahora es de la otra pestaña.
    if (tokenGuardado === null) {
      limpiarSesion(null, false);
      return;
    }
    // Mi propio token vencido: la sesión terminó de verdad.
    if (lectura.estado === 'expirada' && tokenGuardado === actual.token) {
      limpiarSesion('expired');
    }
    // Cualquier otra cosa (token nuevo con tipo o vencimiento viejos o
    // todavía sin escribir) es una escritura a medias: se espera al próximo evento.
  },

  // Descarta también cualquier `me` en vuelo (nueva generación): su respuesta
  // tardía no debe sacar al portal de esta pantalla.
  marcarPortalNoDisponible: () => {
    generacion += 1;
    set({ status: 'portalUnavailable' });
  },
}));

// Escuchas globales del portal. Las monta ProGuard una vez; devuelve la función
// que las quita. Solo eventos del portal y de la pestaña: nunca los del tenant
// (`session-expired`...) ni los del admin.
export function iniciarEscuchasPro(): () => void {
  const alExpirar = () => useProAuthStore.getState().expirar('revoked');
  const alNoDisponible = () => useProAuthStore.getState().marcarPortalNoDisponible();

  // `key === null` es localStorage.clear(): también hay que releer. Cualquier
  // otra key que no sea de la sesión (pro_ultimo_vinculo, las del tenant) se ignora.
  const alCambiarStorage = (e: StorageEvent) => {
    if (e.storageArea !== null && e.storageArea !== localStorage) return;
    if (e.key !== null && !esClaveSesionPro(e.key)) return;
    useProAuthStore.getState().sincronizarDesdeStorage();
  };

  // El vencimiento no espera a que un request falle con 401: se revisa apenas la
  // pestaña vuelve a verse. En un celular la pestaña suele estar congelada en
  // segundo plano y pierde eventos `storage`, por eso también se relee el storage.
  const alCambiarVisibilidad = () => {
    if (document.visibilityState !== 'visible') return;
    useProAuthStore.getState().revisarExpiracion();
    useProAuthStore.getState().sincronizarDesdeStorage();
  };

  window.addEventListener('pro-session-expired', alExpirar);
  window.addEventListener('pro-portal-unavailable', alNoDisponible);
  window.addEventListener('storage', alCambiarStorage);
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  return () => {
    window.removeEventListener('pro-session-expired', alExpirar);
    window.removeEventListener('pro-portal-unavailable', alNoDisponible);
    window.removeEventListener('storage', alCambiarStorage);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  };
}
