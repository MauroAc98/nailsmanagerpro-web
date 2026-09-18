// Vista previa del pin guardado: mapa estático de LocationIQ (misma cuenta y
// key pública que ya usa el picker con Leaflet). Sin key -> null, el caller
// muestra un placeholder en vez de una imagen rota.
export function urlMapaEstatico(lat: number, lon: number, key: string | undefined): string | null {
  if (!key) return null;
  const params = new URLSearchParams({
    key,
    center: `${lat},${lon}`,
    zoom: '16',
    size: '600x300',
    format: 'png',
    markers: `icon:large-red-cutout|${lat},${lon}`,
  });
  return `https://maps.locationiq.com/v3/staticmap?${params.toString()}`;
}
