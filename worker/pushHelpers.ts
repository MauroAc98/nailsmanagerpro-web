// Helpers puros del service worker de notificaciones. Los importa
// worker/index.js (next-pwa lo empaqueta con webpack, así que los imports
// relativos funcionan) y los cubre vitest. Sin APIs de DOM ni de `self`.

export const TITULO_POR_DEFECTO = 'Turnetto';
export const CUERPO_POR_DEFECTO = 'Tenés una novedad en tu agenda.';
export const URL_POR_DEFECTO = '/agenda';

export interface PayloadPush {
  title: string;
  body: string;
  url: string;
  tag?: string;
  timestamp?: number;
  // Actualización silenciosa: reemplaza la notificación con el mismo tag sin volver a avisar.
  silencioso: boolean;
}

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

// `data` es el PushMessageData del evento (o null). Nunca lanza: una
// notificación siempre tiene que mostrarse (iOS castiga los push silenciosos).
export function parsearPayloadPush(data: { json: () => unknown } | null | undefined): PayloadPush {
  let crudo: unknown = null;
  try {
    crudo = data ? data.json() : null;
  } catch {
    crudo = null;
  }
  const o = crudo && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : {};
  return {
    title: texto(o.title) ?? TITULO_POR_DEFECTO,
    body: texto(o.body) ?? CUERPO_POR_DEFECTO,
    url: texto(o.url) ?? URL_POR_DEFECTO,
    tag: texto(o.tag),
    timestamp: typeof o.timestamp === 'number' && Number.isFinite(o.timestamp) ? o.timestamp : undefined,
    silencioso: o.silencioso === true,
  };
}

// Opciones de showNotification. Con tag + renotify:false, reemplazar una notificación
// existente es silencioso; la primera (nada que reemplazar) sí avisa. Por eso NO se usa
// `silent: true`, que mutearía también la primera.
export function opcionesNotificacion(p: PayloadPush, icono: string, badge: string = icono) {
  const opciones: NotificationOptions & { renotify?: boolean; timestamp?: number } = {
    body: p.body,
    icon: icono,
    // Android dibuja el badge solo con el canal alfa: con el logo de fondo blanco se ve un cuadrado liso.
    // Se pasa una silueta blanca sobre fondo transparente (public/badge-96.png); sin ella cae al ícono.
    badge,
    data: { url: p.url },
    renotify: Boolean(p.tag) && !p.silencioso,
  };
  if (p.tag) opciones.tag = p.tag;
  if (p.timestamp) opciones.timestamp = p.timestamp;
  return opciones;
}

// Resuelve `url` contra el origen del SW y solo deja pasar el mismo origen;
// cualquier otra cosa (otro dominio, javascript:, inválida) cae en /agenda.
export function urlMismoOrigen(url: string | undefined | null, origen: string): string {
  const porDefecto = new URL(URL_POR_DEFECTO, origen).href;
  if (!url) return porDefecto;
  try {
    const resuelta = new URL(url, origen);
    return resuelta.origin === new URL(origen).origin ? resuelta.href : porDefecto;
  } catch {
    return porDefecto;
  }
}

// ─── pushsubscriptionchange ─────────────────────────────────────────────
// El navegador puede rotar la suscripción (vence, o la renueva el servicio de
// push). El SW NO puede avisarle al servidor: la API exige el token de sesión,
// que vive en localStorage (inaccesible desde el worker) y no se copia a ningún
// lado. Por eso solo (1) re-suscribe con la misma clave del servidor y (2) avisa
// a las ventanas abiertas; el re-enlace con el servidor lo hace la app
// (hooks/useReenlazarPush) cuando está abierta o en su próximo arranque.

export const MENSAJE_SUSCRIPCION_CAMBIO = { type: 'push-subscription-changed' } as const;

export type ResultadoCambioSuscripcion = 'resuscripto' | 'sin-clave' | 'error';

interface SuscripcionAnterior {
  options?: { applicationServerKey?: ArrayBuffer | null } | null;
}

interface RegistroPush {
  pushManager: {
    subscribe: (o: { userVisibleOnly: boolean; applicationServerKey: ArrayBuffer }) => Promise<unknown>;
  };
}

interface ClientesVentana {
  matchAll: (o: { type: 'window'; includeUncontrolled: boolean }) => Promise<{ postMessage: (m: unknown) => void }[]>;
}

// Nunca lanza. Sin la clave anterior no se puede re-suscribir (no hay forma de
// conocer la del servidor sin la API autenticada): no se hace nada destructivo
// y solo se avisa a la app.
export async function manejarCambioDeSuscripcion(
  anterior: SuscripcionAnterior | null | undefined,
  registro: RegistroPush,
  clientes: ClientesVentana,
): Promise<ResultadoCambioSuscripcion> {
  const clave = anterior?.options?.applicationServerKey ?? null;
  let resultado: ResultadoCambioSuscripcion = 'sin-clave';
  if (clave) {
    try {
      await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
      resultado = 'resuscripto';
    } catch {
      resultado = 'error';
    }
  }
  try {
    const ventanas = await clientes.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      try {
        v.postMessage(MENSAJE_SUSCRIPCION_CAMBIO);
      } catch {
        // una ventana que falla no impide avisar a las demás
      }
    }
  } catch {
    // sin ventanas abiertas la app lo resuelve en su próximo arranque
  }
  return resultado;
}
