'use client';

import { forwardRef } from 'react';
import { LayoutId, EstiloId } from '@/services/profesionalService';
import { Servicio } from '@/services/servicioService';
import { LAYOUTS, ESTILOS } from './catalogo';
import { TarjetaPrecios } from './TarjetaPrecios';

export const BASE_WIDTH  = 420;
export const BASE_HEIGHT = (BASE_WIDTH * 16) / 9;

interface Props {
  layoutId:  LayoutId;
  estiloId:  EstiloId;
  fotos:     string[];
  servicios: Servicio[];
}

// HistoriaPreciosCanvas — always renders at the intrinsic BASE_WIDTH /
// BASE_HEIGHT, never a `scale` or `mode` prop. forwardRef exposes the INNER
// unscaled node so both the picker thumbnails (via MiniaturaCanvas's CSS
// transform) and the final html-to-image capture rasterize the exact same
// DOM. A `mode: 'preview' | 'export'` prop would be a second code path in
// disguise — fonts and any future FitText-style measurement would round
// differently against a different width, silently breaking the "preview
// matches export" guarantee (spec: price-story-templates). See design
// decision D3 in sdd/dynamic-price-story.
export const HistoriaPreciosCanvas = forwardRef<HTMLDivElement, Props>(function HistoriaPreciosCanvas(
  { layoutId, estiloId, fotos, servicios },
  ref
) {
  const layout = LAYOUTS.find(l => l.id === layoutId) ?? LAYOUTS[0];
  const estilo = ESTILOS.find(e => e.id === estiloId) ?? ESTILOS[0];
  const Layout = layout.Component;

  return (
    // Outer wrapper: on-screen look only (rounded corners). The captured
    // node is the inner one (has `ref`) and has NO borderRadius of its own
    // — same reasoning as StoryCanvas: a rounded corner baked into the
    // exported PNG shows as transparent/black corners on a full-bleed
    // consumer (Instagram/WhatsApp Status).
    <div style={{ width: BASE_WIDTH, height: BASE_HEIGHT, borderRadius: 16, overflow: 'hidden' }}>
      <div
        ref={ref}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      >
        <Layout fotos={fotos} overlayOpacity={estilo.tokens.overlayOpacity}>
          <TarjetaPrecios tokens={estilo.tokens} servicios={servicios} />
        </Layout>
      </div>
    </div>
  );
});
