'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { MapaErrorBoundary } from './MapaErrorBoundary';

// `MapaPicker` es lo único que toca `window`/Leaflet (design D3) — se carga
// vía `dynamic(..., { ssr: false })` para que nunca se evalúe en SSR, y es
// el único punto que necesita `vi.mock` en tests (jsdom no puede ejercitar
// las APIs de Leaflet).
const MapaPicker = dynamic(() => import('./MapaPicker').then(m => m.MapaPicker), {
  ssr: false,
  loading: () => null,
});

interface Props {
  latitud: number | null;
  longitud: number | null;
  direccion: string;
  onCancelar: () => void;
  onConfirmar: (lat: number, lng: number) => void;
}

// Mismo z-index que LogoCropModal (design D2): modal exclusivo, nunca debajo
// de otro overlay mientras está abierto.
const Z_INDEX = 200;

export function UbicacionMapaModal({ latitud, longitud, direccion, onCancelar, onConfirmar }: Props) {
  const t = useTranslations('perfil.SheetDatosPersonales');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    latitud !== null && longitud !== null ? { lat: latitud, lng: longitud } : null,
  );

  const handleConfirmar = () => {
    if (!pin) return;
    onConfirmar(pin.lat, pin.lng);
  };

  // `touch-action`/`overscroll-behavior` (abajo) son el mecanismo MODERNO
  // para bloquear gestos del navegador, pero Safari/iOS tiene uno VIEJO y
  // separado para el pellizco de 2 dedos: los eventos `gesturestart` /
  // `gesturechange` / `gestureend` (no estándar, solo WebKit) — el CSS
  // touch-action NO los bloquea, es un gap conocido de WebKit. Sin este
  // preventDefault, un pellizco sobre el mapa dispara el zoom nativo de la
  // página aunque `userScalable: false` esté seteado globalmente
  // (app/layout.tsx), y en la PWA standalone eso se ve como si el modal
  // "se cerrara" (el viewport entero se reacomoda). `{ passive: false }`
  // es obligatorio: sin eso `preventDefault()` no tiene efecto.
  useEffect(() => {
    const bloquear = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', bloquear, { passive: false });
    document.addEventListener('gesturechange', bloquear, { passive: false });
    document.addEventListener('gestureend', bloquear, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', bloquear);
      document.removeEventListener('gesturechange', bloquear);
      document.removeEventListener('gestureend', bloquear);
    };
  }, []);

  // React burbujea los eventos de un portal por el árbol de COMPONENTES, no
  // por el del DOM real (es un comportamiento documentado de React, no un
  // bug) — aunque este modal se dibuja en `document.body`, para React sigue
  // siendo hijo de `SheetDatosPersonales`, que vive dentro del `BottomSheet`.
  // `BottomSheet.tsx:334-336` escucha pointerdown/move/up en su contenido y
  // hace `setPointerCapture` en cuanto detecta uno — eso le roba el puntero
  // a Leaflet A MITAD de un pellizco (de ahí "no carga bien y se cierra",
  // reportado igual en Android y iOS: no es un gesto de sistema operativo,
  // es este cruce de React). Cortar la propagación acá arriba es suficiente
  // — Leaflet escucha touch/pointer nativos directo en su propio nodo del
  // DOM, no vía burbujeo de React, así que esto no le afecta nada.
  const detenerBurbujeo = (e: React.PointerEvent) => e.stopPropagation();

  return createPortal(
    <div
      onPointerDown={detenerBurbujeo}
      onPointerMove={detenerBurbujeo}
      onPointerUp={detenerBurbujeo}
      style={{
        position: 'fixed', inset: 0, zIndex: Z_INDEX,
        backgroundColor: '#000', display: 'flex', flexDirection: 'column',
        // El pinch-zoom/drag sobre el mapa puede extenderse un pixel más allá
        // del <div> de Leaflet (que ya trae su propio touch-action:none) hacia
        // este contenedor — sin cortarlo acá también, el navegador lo lee como
        // un gesto nativo (pull-to-refresh / swipe-back) y en PWA standalone
        // eso recarga o navega la app entera, lo que se ve como "el modal se
        // cierra solo". overscrollBehavior:'none' bloquea el rebote/navegación
        // nativa; touchAction:'none' evita que el navegador interprete el
        // gesto como scroll/zoom de página antes de que Leaflet lo capture.
        overscrollBehavior: 'none', touchAction: 'none',
      }}
    >
      <div style={{ flex: 1, position: 'relative', overscrollBehavior: 'none', touchAction: 'none' }}>
        <MapaErrorBoundary>
          <MapaPicker
            latitud={latitud}
            longitud={longitud}
            direccion={direccion}
            onPinMovido={(lat, lng) => setPin({ lat, lng })}
          />
        </MapaErrorBoundary>
      </div>

      <div style={{
        padding: '18px 20px calc(18px + env(safe-area-inset-bottom))',
        backgroundColor: colors.surface, boxShadow: shadows.sheet,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, textAlign: 'center' }}>
          {t('mapInstructions')}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface, color: colors.text, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('mapCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!pin}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: 'none',
              backgroundColor: colors.primarySolid, color: '#FFF', fontSize: 14, fontWeight: 700,
              cursor: pin ? 'pointer' : 'default', opacity: pin ? 1 : 0.6,
            }}
          >
            {t('mapConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
