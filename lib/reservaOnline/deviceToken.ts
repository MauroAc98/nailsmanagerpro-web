// Token opaco de dispositivo (decision A4 del diseno de la slice 3): generado
// una sola vez en el navegador y persistido para que el backend lo hashee sin
// identificar a la clienta (viaja en el header X-Device-Token en cada
// escritura real, decision A9). Formato exigido por ExigeDeviceToken:
// [A-Za-z0-9_-]{32,128}.
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEVICE_TOKEN_KEY = 'ro_device_v1';

// Fallback si el storage no esta disponible o esta bloqueado (navegacion
// privada): el token sigue funcionando en memoria durante la sesion de la
// pestana, solo no sobrevive a un refresh.
let memoria: string | null = null;

export function resetDeviceTokenParaTests(): void {
  memoria = null;
}

function generar(): string {
  const bytes = new Uint8Array(24); // -> 32 chars base64url, dentro de 32-128
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  const base64 = typeof btoa === 'function' ? btoa(binario) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function storageUsable(storage: StorageLike | undefined): StorageLike | null {
  if (!storage) return typeof localStorage === 'undefined' ? null : localStorage;
  return storage;
}

// Inyectable para tests; sin argumento usa localStorage (con fallback en
// memoria si esta bloqueado o no existe).
export function getDeviceToken(storage?: StorageLike): string {
  const s = storageUsable(storage);
  if (s) {
    try {
      const existente = s.getItem(DEVICE_TOKEN_KEY);
      if (existente) return existente;
      const nuevo = generar();
      s.setItem(DEVICE_TOKEN_KEY, nuevo);
      return nuevo;
    } catch {
      // getItem/setItem pueden tirar (cuota, navegacion privada): fallback en memoria
    }
  }
  if (!memoria) memoria = generar();
  return memoria;
}
