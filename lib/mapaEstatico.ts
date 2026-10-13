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
    // Doble densidad: la imagen se muestra a todo el ancho de la hoja (~350-390 px de
    // pantalla, 3x en un celular) y a 600x300 reales se estiraba y se veía pixelada.
    // scale=2 la dibuja en 1200x600 con la misma composición (~250 KB, menos que
    // pedir size=1200x600, y el texto del mapa queda nítido). El pin del servicio
    // no se duplica, así que se ve algo más chico.
    scale: '2',
    format: 'png',
    markers: `icon:large-red-cutout|${lat},${lon}`,
  });
  return `https://maps.locationiq.com/v3/staticmap?${params.toString()}`;
}
