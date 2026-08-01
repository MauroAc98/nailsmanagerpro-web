'use client';

import { LayoutId, EstiloId } from '@/services/profesionalService';
import { Servicio } from '@/services/servicioService';
import { HistoriaPreciosCanvas, BASE_WIDTH, BASE_HEIGHT } from './HistoriaPreciosCanvas';

interface Props {
  layoutId:      LayoutId;
  estiloId:      EstiloId;
  fotos:         string[];
  servicios:     Servicio[];
  nombreNegocio: string;
  telefono:      string | null;
  // Target on-screen width of the thumbnail — height is derived to keep
  // BASE_WIDTH/BASE_HEIGHT's aspect ratio.
  width:         number;
}

// MiniaturaCanvas — renders HistoriaPreciosCanvas at its real BASE_WIDTH /
// BASE_HEIGHT and shrinks it with a CSS `transform: scale()` instead of a
// `scale` prop threaded into the canvas itself. This keeps the picker
// preview and the final export byte-identical (see D3) — only the outer box
// is smaller, the DOM node under the transform is untouched. Thumbnails are
// inert (`pointer-events: none`): no drag/click passthrough into the canvas
// underneath, selection happens on the wrapping button in SelectorPlantilla.
export function MiniaturaCanvas({ layoutId, estiloId, fotos, servicios, nombreNegocio, telefono, width }: Props) {
  const scale  = width / BASE_WIDTH;
  const height = BASE_HEIGHT * scale;

  return (
    <div
      style={{
        width, height, overflow: 'hidden', borderRadius: 12,
        pointerEvents: 'none', position: 'relative',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <HistoriaPreciosCanvas
          layoutId={layoutId}
          estiloId={estiloId}
          fotos={fotos}
          servicios={servicios}
          nombreNegocio={nombreNegocio}
          telefono={telefono}
        />
      </div>
    </div>
  );
}
