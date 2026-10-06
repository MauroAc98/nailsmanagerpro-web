'use client';

import { forwardRef } from 'react';
import { TemplateId } from '@/services/profesionalService';
import { Servicio } from '@/services/servicioService';
import { TEMPLATES } from './catalogo';
import { TarjetaPrecios } from './TarjetaPrecios';
import { PieContacto } from '@/components/historia/PieContacto';
import type { ResultadoDensidad } from '@/lib/historiaDensidad';

export const BASE_WIDTH  = 420;
export const BASE_HEIGHT = (BASE_WIDTH * 16) / 9;

// Zona inferior (px, a BASE_WIDTH) reservada para el pie de contacto que se
// dibuja sobre la foto: divisor 1 + 10 de margen + CTA ~20 + 3 de gap + línea
// de contacto 2+16 (hasta 2 renglones = 32) ≈ 68, más 24 de aire contra el
// borde inferior. Constante (no medida) para que el ajuste de la tarjeta y la
// captura con html-to-image sean deterministas; la tarjeta tiene además su
// propio padding inferior (16) de holgura si un nombre largo ocupa 3 renglones.
export const FOOTER_RESERVA = 96;
const FOOTER_PADDING_BOTTOM = 24;
const FOOTER_PADDING_X = 40;

interface Props {
  templateId:    TemplateId;
  fotos:         string[];
  titulo:        string;
  servicios:     Servicio[];
  nombreNegocio: string;
  telefono:      string | null;
  profesionalNombre?: string;
  nota?: string;
  notaAlineacion?: 'left' | 'center' | 'right' | 'justify';
  // Ver TarjetaPrecios: el canvas principal mide y reporta (`onFitChange`,
  // estable); las miniaturas pasan `nivelDensidad` y no miden.
  nivelDensidad?: number;
  onFitChange?:   (resultado: ResultadoDensidad) => void;
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
  { templateId, fotos, titulo, servicios, nombreNegocio, telefono, profesionalNombre, nota, notaAlineacion, nivelDensidad, onFitChange },
  ref
) {
  const template = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];
  const Layout = template.Component;

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
        <Layout fotos={fotos} overlayOpacity={template.tokens.overlayOpacity}>
          <TarjetaPrecios
            tokens={template.tokens}
            titulo={titulo}
            servicios={servicios}
            nombreNegocio={nombreNegocio}
            profesionalNombre={profesionalNombre}
            nota={nota}
            notaAlineacion={notaAlineacion}
            variante={template.cardVariant}
            align={template.align}
            nivelDensidad={nivelDensidad}
            onFitChange={onFitChange}
            reservaInferior={FOOTER_RESERVA}
          />
        </Layout>
        {/* Scrim local detrás del pie: degradé a negro solo en la franja
            inferior (misma altura que la zona reservada), sin oscurecer toda
            la foto. A diferencia del blur de StoryCanvas no se reutiliza esa
            técnica: acá cada plantilla pone una foto distinta abajo, y un
            degradé es un fondo CSS que html-to-image captura sin problema. */}
        <div
          data-testid="historia-precios-scrim"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: FOOTER_RESERVA + 24,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.7) 100%)',
          }}
        />
        {/* Pie sobre la foto, fuera de la tarjeta — mismo componente que la
            historia de turnos (PieContacto). Nombre: la profesional elegida a
            mano, si no el negocio. */}
        <div
          data-testid="historia-precios-pie"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: `0 ${FOOTER_PADDING_X}px ${FOOTER_PADDING_BOTTOM}px`,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <PieContacto nombre={profesionalNombre || nombreNegocio} telefono={telefono} />
        </div>
      </div>
    </div>
  );
});
