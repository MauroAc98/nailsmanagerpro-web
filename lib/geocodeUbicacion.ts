// Geocode "best effort" para centrar el mapa en la dirección tipeada
// (design D5). Usa `fetch` DIRECTO, no la instancia `api` de axios: esa
// instancia agrega el bearer token del salón y el baseURL propio, ninguno
// de los dos corresponde acá — es un request público a un host de terceros.
//
// Nunca bloquea ni tira: cualquier falla (timeout, red caída, respuesta no
// exitosa, sin resultados) resuelve a `null`. Abrir el picker y soltar el
// pin NUNCA dependen de que esto resuelva.

const TIMEOUT_MS = 4000;

export interface GeocodeResultado {
  lat: number;
  lon: number;
}

export async function geocodeUbicacion(direccion: string): Promise<GeocodeResultado | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const key = process.env.NEXT_PUBLIC_LOCATIONIQ_KEY ?? '';
    const url = `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(key)}&q=${encodeURIComponent(direccion)}&format=json&limit=1`;

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = Number(data[0]?.lat);
    const lon = Number(data[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
