'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CENTRO_FALLBACK, esUbicacionValida } from '@/lib/ubicacion';
import { geocodeUbicacion } from '@/lib/geocodeUbicacion';
import { obtenerGps } from '@/lib/obtenerGps';
import { MapaBuscador } from './MapaBuscador';

interface Props {
  latitud: number | null;
  longitud: number | null;
  onPinMovido: (lat: number, lng: number) => void;
}

// Pin inline (mismo SVG que SheetDatosPersonales, ver design D1) — evita un
// asset de imagen que Leaflet resolvería como URL relativa y rompería bajo
// el bundler (el gotcha clásico de `L.Icon.Default`).
const PIN_SVG = `
<svg width="32" height="32" viewBox="0 0 24 24" fill="#E11D48" stroke="#FFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
  <circle cx="12" cy="10" r="3" fill="#FFF" stroke="none" />
</svg>`;

function crearPinIcon(): L.DivIcon {
  return L.divIcon({
    html: PIN_SVG,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

// Atribución exacta requerida por el free tier de LocationIQ (design D6) —
// NO reemplazar por un string genérico de OSM, los términos exigen este
// link puntual de vuelta a locationiq.com.
const ATRIBUCION_LOCATIONIQ =
  '<a href="https://locationiq.com">Search by LocationIQ.com</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function MapaPicker({ latitud, longitud, onPinMovido }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorRef = useRef<L.Marker | null>(null);
  // El pin se movió (drag manual del usuario) — a partir de ese momento el
  // geocode NUNCA debe re-centrar el mapa (design D5: prioridad
  // guardado -> geocode -> fallback, y solo si el pin sigue intacto).
  const pinTocadoRef = useRef(false);

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const tieneGuardada = esUbicacionValida(latitud, longitud);
    const centroInicial = tieneGuardada
      ? { lat: latitud as number, lng: longitud as number }
      : { lat: CENTRO_FALLBACK.lat, lng: CENTRO_FALLBACK.lng };
    const zoomInicial = tieneGuardada ? 16 : CENTRO_FALLBACK.zoom;

    const mapa = L.map(contenedorRef.current).setView(
      [centroInicial.lat, centroInicial.lng],
      zoomInicial,
    );
    mapaRef.current = mapa;

    L.tileLayer('https://{s}-tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key={key}', {
      key: process.env.NEXT_PUBLIC_LOCATIONIQ_KEY ?? '',
      attribution: ATRIBUCION_LOCATIONIQ,
      maxZoom: 19,
    } as L.TileLayerOptions).addTo(mapa);

    const marcador = L.marker([centroInicial.lat, centroInicial.lng], {
      icon: crearPinIcon(),
      draggable: true,
    }).addTo(mapa);
    marcadorRef.current = marcador;

    marcador.on('dragend', () => {
      pinTocadoRef.current = true;
      const pos = marcador.getLatLng();
      onPinMovido(pos.lat, pos.lng);
    });

    mapa.on('click', (e: L.LeafletMouseEvent) => {
      pinTocadoRef.current = true;
      marcador.setLatLng(e.latlng);
      onPinMovido(e.latlng.lat, e.latlng.lng);
    });

    // GPS del dispositivo SOLO si no hay coordenadas guardadas — nunca
    // bloquea la creación del mapa ni el drop del pin (design D5). Reemplaza
    // al geocode de la dirección tipeada (feedback de producción: la
    // dirección en texto libre geocodifica mal, "se va para cualquier
    // lado" — el GPS es un punto de partida mucho más confiable, y el pin
    // sigue siendo lo que el salón ajusta y confirma al final).
    if (!tieneGuardada) {
      obtenerGps().then((resultado) => {
        if (!resultado || pinTocadoRef.current || !mapaRef.current) return;
        mapaRef.current.setView([resultado.lat, resultado.lon], 16);
        marcadorRef.current?.setLatLng([resultado.lat, resultado.lon]);
      });
    }

    return () => {
      mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se inicializa una sola vez; cambios posteriores de props no deben recrear el mapa
  }, []);

  // Buscador de texto (feedback post-lanzamiento): reusa el mismo
  // `geocodeUbicacion` que centra el mapa al abrir, pero on-demand — a
  // diferencia de ese geocode inicial, ESTE resultado si mueve el pin (el
  // usuario buscó algo a propósito, no es un best-effort de fondo).
  const buscar = async (query: string): Promise<boolean> => {
    const resultado = await geocodeUbicacion(query);
    if (!resultado || !mapaRef.current || !marcadorRef.current) return false;
    pinTocadoRef.current = true;
    mapaRef.current.setView([resultado.lat, resultado.lon], 16);
    marcadorRef.current.setLatLng([resultado.lat, resultado.lon]);
    onPinMovido(resultado.lat, resultado.lon);
    return true;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />
      <MapaBuscador onBuscar={buscar} />
    </div>
  );
}
