// Tiles del mapa de ubicación (LocationIQ, vía Leaflet).
//
// `{r}` lo reemplaza Leaflet por "@2x" cuando la pantalla es retina
// (devicePixelRatio > 1) y por nada en las demás: LocationIQ sirve el mismo tile
// a 256 px o a 512 px (`.../{y}@2x.png`). Sin esto un celular (2–3 px físicos
// por px de pantalla) estiraba el tile de 256 px y el mapa se veía pixelado.
// Sigue siendo UNA petición por tile, no cuatro como con `detectRetina`.
//
// El patrón de la caché de tiles de la PWA (`tilesLocationIq` en
// next.config.ts) matchea por host y por `/v3/`, así que esta URL sigue cacheada.
export const URL_TILES_LOCATIONIQ =
  'https://{s}-tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}{r}.png?key={key}';
