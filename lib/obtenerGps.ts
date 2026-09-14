// Ubicación por GPS del dispositivo — reemplaza al geocode de la dirección
// tipeada como forma de centrar el mapa al abrir el picker (feedback de
// producción: la dirección en texto libre geocodifica mal, "se va para
// cualquier lado"; el GPS es mucho más preciso como punto de partida). El
// pin sigue siendo la fuente de verdad — esto solo decide dónde arranca el
// mapa, el usuario lo ajusta arrastrando igual que siempre.
//
// Nunca bloquea ni tira: sin soporte, sin permiso, timeout o cualquier otro
// error resuelve `null` — el picker cae al fallback de ciudad (design D5).

const TIMEOUT_MS = 6000;

export interface GpsResultado {
  lat: number;
  lon: number;
}

export function obtenerGps(): Promise<GpsResultado | null> {
  return new Promise((resolve) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 },
      );
    } catch {
      resolve(null);
    }
  });
}
