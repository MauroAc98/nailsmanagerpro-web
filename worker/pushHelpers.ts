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
  };
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
