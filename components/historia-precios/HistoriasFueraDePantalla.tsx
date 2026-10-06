'use client';

import type { ComponentProps } from 'react';
import type { Historia } from '@/lib/historiaHistorias';
import type { ResultadoDensidad } from '@/lib/historiaDensidad';
import { HistoriaPreciosCanvas, BASE_WIDTH, BASE_HEIGHT } from './HistoriaPreciosCanvas';

type CanvasProps = Omit<ComponentProps<typeof HistoriaPreciosCanvas>, 'servicios' | 'subtitulo' | 'onFitChange' | 'nivelDensidad'>;

interface Props extends CanvasProps {
  historias:        Historia[];
  registrarCanvas:  (id: string) => (el: HTMLDivElement | null) => void;
  reportarFit:      (id: string, r: ResultadoDensidad) => void;
}

// Todas las historias del modo "una por categoría" a tamaño real, fuera de
// pantalla: el ajuste de CADA una se mide acá (cada tarjeta reporta con su
// propio onFitChange) y estos son los nodos que se capturan al exportar.
//
// No es display:none ni visibility:hidden: hacen falta layout real para medir
// con useLayoutEffect y para que html-to-image rasterice. Se saca de la
// pantalla con position:fixed + left muy negativo; aria-hidden y
// pointer-events:none para que ni lectores de pantalla ni toques lo vean.
// Mismo componente y mismas props que el preview, así el export coincide con
// lo que se ve.
export function HistoriasFueraDePantalla({ historias, registrarCanvas, reportarFit, ...canvas }: Props) {
  return (
    <div
      aria-hidden="true"
      data-testid="historias-fuera-de-pantalla"
      style={{
        position: 'fixed', top: 0, left: -10000, width: BASE_WIDTH, height: BASE_HEIGHT,
        pointerEvents: 'none', overflow: 'hidden',
      }}
    >
      {historias.map(h => (
        <div key={h.id} style={{ position: 'absolute', top: 0, left: 0, width: BASE_WIDTH, height: BASE_HEIGHT }}>
          <HistoriaPreciosCanvas
            {...canvas}
            ref={registrarCanvas(h.id)}
            subtitulo={h.titulo ?? undefined}
            servicios={h.servicios}
            onFitChange={r => reportarFit(h.id, r)}
          />
        </div>
      ))}
    </div>
  );
}
