'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { FotoTile } from './FotoTile';

// Visor de fotos a pantalla completa ("lightbox"), compartido por el editor
// de fotos del salon (FotosServicioEditor) y el detalle publico de un
// servicio (DetalleServicioScreen) — un solo lugar para no duplicar el
// swipe/zoom/pan entre las dos pantallas. Componente controlado: el padre
// decide cuando mostrarlo/ocultarlo (mismo patron que LogoCropModal/
// UbicacionMapaModal, sin store propio).
//
// Zoom: sin pinch real de dos dedos a proposito — el viewport de la app fija
// userScalable:false/maximumScale:1 (ver app/layout.tsx) y un pinch propio a
// mano es un esfuerzo aparte; doble-tap para alternar 1x/2.5x + arrastre
// para paniar mientras esta ampliada cubre el caso de uso sin ese riesgo.
const ZOOM = 2.5;
const TOLERANCIA_TAP_PX = 10; // debajo de esto, un pointerdown/up cuenta como "tap", no arrastre
const UMBRAL_SWIPE_PX = 60; // arrastre horizontal minimo (a 1x) para pasar de foto
const DOBLE_TAP_MS = 300;
const DOBLE_TAP_TOLERANCIA_PX = 30;

// Encima de todo lo demas en la app, mismo nivel que LogoCropModal/
// UbicacionMapaModal (modales de foto disparados por una accion explicita
// del usuario) — nunca deberia quedar tapado por un sheet/toast/confirm.
const Z_INDEX = 200;

function clamp(valor: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valor));
}

export function VisorFotos({
  fotos,
  indiceInicial,
  onClose,
}: {
  fotos: string[];
  indiceInicial: number;
  onClose: () => void;
}) {
  const t = useTranslations('reservaOnline.visor');
  const [indice, setIndice] = useState(() => clamp(indiceInicial, 0, fotos.length - 1));
  const [ampliada, setAmpliada] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Si hay un gesto de puntero en curso — solo para decidir si la foto
  // transiciona (snap suave) o sigue al dedo sin lag. Estado (no ref): el
  // valor se lee durante el render para elegir el estilo de `transition`.
  const [arrastrando, setArrastrando] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  // Estado del gesto en curso — refs porque no necesitan re-render por si
  // solos, solo al soltar (o, si esta ampliada, en cada move para paniar).
  const gesto = useRef<{ x0: number; y0: number; panX0: number; panY0: number; dx: number; movio: boolean } | null>(
    null,
  );
  const ultimoTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const irA = (nuevoIndice: number) => {
    const acotado = clamp(nuevoIndice, 0, fotos.length - 1);
    if (acotado === indice) return;
    setIndice(acotado);
    setAmpliada(false);
    setPan({ x: 0, y: 0 });
  };

  const alternarZoom = (x: number, y: number) => {
    if (ampliada) {
      setAmpliada(false);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) {
      setAmpliada(true);
      return;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxX = (rect.width * (ZOOM - 1)) / 2;
    const maxY = (rect.height * (ZOOM - 1)) / 2;
    // Centrado en el punto tocado: ver derivacion en el comentario de
    // handlePointerUp mas abajo.
    setPan({
      x: clamp((x - cx) * (1 - ZOOM), -maxX, maxX),
      y: clamp((y - cy) * (1 - ZOOM), -maxY, maxY),
    });
    setAmpliada(true);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // jsdom (tests) no implementa setPointerCapture — guardado para no
    // depender de el (mismo criterio defensivo que un guard de feature-detect).
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesto.current = { x0: e.clientX, y0: e.clientY, panX0: pan.x, panY0: pan.y, dx: 0, movio: false };
    setArrastrando(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (Math.abs(dx) > TOLERANCIA_TAP_PX || Math.abs(dy) > TOLERANCIA_TAP_PX) g.movio = true;
    g.dx = dx;
    if (ampliada) {
      const rect = areaRef.current?.getBoundingClientRect();
      const maxX = rect ? (rect.width * (ZOOM - 1)) / 2 : 0;
      const maxY = rect ? (rect.height * (ZOOM - 1)) / 2 : 0;
      setPan({ x: clamp(g.panX0 + dx, -maxX, maxX), y: clamp(g.panY0 + dy, -maxY, maxY) });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    gesto.current = null;
    setArrastrando(false);
    if (!g) return;

    if (!ampliada && g.movio && Math.abs(g.dx) > UMBRAL_SWIPE_PX) {
      // Arrastre a la izquierda (dx negativo) = avanzar; a la derecha = retroceder.
      irA(indice + (g.dx < 0 ? 1 : -1));
      return;
    }
    if (g.movio) return; // arrastre corto que no llego al umbral: no hace nada mas

    // Tap (sin arrastre): ¿es el segundo de un doble tap?
    const ahora = e.timeStamp;
    const previo = ultimoTap.current;
    const esDobleTap =
      !!previo &&
      ahora - previo.t < DOBLE_TAP_MS &&
      Math.abs(e.clientX - previo.x) < DOBLE_TAP_TOLERANCIA_PX &&
      Math.abs(e.clientY - previo.y) < DOBLE_TAP_TOLERANCIA_PX;

    if (esDobleTap) {
      ultimoTap.current = null;
      alternarZoom(e.clientX, e.clientY);
      return;
    }
    ultimoTap.current = { t: ahora, x: e.clientX, y: e.clientY };

    // Tap simple sobre el fondo (no sobre la foto misma) = cerrar, igual que
    // tocar afuera de la foto en el resto del overlay.
    if (e.target === areaRef.current) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        background: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('cerrar')}
        style={{
          position: 'absolute',
          top: 'calc(12px + env(safe-area-inset-top))',
          right: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          border: 'none',
          padding: 0,
          background: 'rgba(255, 255, 255, 0.18)',
          color: '#fff',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <span aria-hidden="true">×</span>
      </button>

      {fotos.length > 1 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(16px + env(safe-area-inset-top))',
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t('contador', { actual: indice + 1, total: fotos.length })}
        </div>
      )}

      <div
        ref={areaRef}
        data-testid="visor-fotos-area"
        data-ampliada={ampliada}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        {/* Caja mas chica que el area (92%): deja un margen de "fondo" real
            alrededor de la foto (mas alla del letterboxing propio de
            object-fit:contain, que no expone el area de atras al hit-test)
            para que tocar afuera de la foto siempre tenga donde caer,
            incluso con una foto que coincide en aspect-ratio con la pantalla. */}
        <div style={{ width: '92%', height: '92%', position: 'relative' }}>
          <FotoTile
            src={fotos[indice]}
            objectFit="contain"
            iconoTam={40}
            estilo={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${ampliada ? ZOOM : 1})`,
              transition: arrastrando ? 'none' : 'transform 0.2s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}
