// Lógica pura de los avisos de reservas online (Web Push). Sin DOM ni red:
// el hook (hooks/useAvisosReservas.ts) le pasa el entorno ya leído.

export type EstadoAvisos = 'unsupported' | 'ios-needs-install' | 'denied' | 'off' | 'on';
export type ErrorAvisos = 'unavailable' | 'network' | 'generic';

export interface EntornoAvisos {
  tieneServiceWorker: boolean;
  tienePushManager: boolean;
  tieneNotification: boolean;
  esIOS: boolean;
  esStandalone: boolean;
  permiso: NotificationPermission;
  suscrito: boolean;
}

// Clave pública VAPID (base64url) -> bytes para pushManager.subscribe().
// Se devuelve sobre un ArrayBuffer propio (BufferSource válido para TS 5.7+).
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(base64);
  const salida = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) salida[i] = crudo.charCodeAt(i);
  return salida;
}

export function esIOS(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS 13+ se presenta como "Macintosh" pero con pantalla táctil.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function calcularEstadoAvisos(e: EntornoAvisos): EstadoAvisos {
  // En iOS los avisos solo existen con la app agregada a la pantalla de
  // inicio; en Safari común ni siquiera aparece PushManager, así que esto va
  // antes del chequeo de soporte para dar la instrucción correcta.
  if (e.esIOS && !e.esStandalone) return 'ios-needs-install';
  if (!e.tieneServiceWorker || !e.tienePushManager || !e.tieneNotification) return 'unsupported';
  if (e.permiso === 'denied') return 'denied';
  if (e.permiso === 'granted' && e.suscrito) return 'on';
  return 'off';
}

export function errorDeActivacion(e: unknown): ErrorAvisos {
  const err = e as { response?: { status?: number }; request?: unknown } | null;
  if (err?.response?.status === 503) return 'unavailable';
  if (err && !err.response && err.request) return 'network';
  return 'generic';
}
