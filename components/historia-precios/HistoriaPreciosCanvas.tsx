'use client';

import { forwardRef } from 'react';
import { TemplateId } from '@/services/profesionalService';
import { Servicio } from '@/services/servicioService';
import { TEMPLATES } from './catalogo';
import { TarjetaPrecios } from './TarjetaPrecios';
import { PieContacto } from '@/components/historia/PieContacto';
import { EncabezadoHistoria, alturaZonaEncabezado, reservaSuperiorEncabezado } from './EncabezadoHistoria';
import type { ResultadoDensidad } from '@/lib/historiaDensidad';

export const BASE_WIDTH  = 420;
export const BASE_HEIGHT = (BASE_WIDTH * 16) / 9;

// Zona inferior (px, a BASE_WIDTH) reservada para el pie de contacto que se
// dibuja sobre la foto. El pie (divisor 1 + 10 de margen + CTA ~20 + 3 de gap +
// línea de contacto 2+16, hasta 2 renglones = 32 ≈ 68, más 4 de holgura) se
// sube un poco del borde inferior para que la barra de responder/enviar de
// Instagram/WhatsApp no lo tape. Es un margen chico a propósito (7% del alto,
// no el 16% completo de lib/historia/safeArea.ts): con más el pie flota alto
// sobre la foto. Constante (no medida) para que el ajuste de la tarjeta y la
// captura con html-to-image sean deterministas.
const FOOTER_ALTO = 72;
const FOOTER_PADDING_BOTTOM = Math.round(BASE_HEIGHT * 0.07);
export const FOOTER_RESERVA = FOOTER_ALTO + FOOTER_PADDING_BOTTOM;
const FOOTER_PADDING_X = 40;

interface Props {
  templateId:    TemplateId;
  fotos:         string[];
  titulo:        string;
  subtitulo?:    string;
  servicios:     Servicio[];
  nombreNegocio: string;
  telefono:      string | null;
  profesionalNombre?: string;
  // Foto del recuadro del encabezado (ya proxiada/horneada) y posición en la
  // serie ("1/4"); ver EncabezadoHistoria.
  logoUrl?: string | null;
  serie?: { actual: number; total: number };
  nota?: string;
  notaAlineacion?: 'left' | 'center' | 'right' | 'justify';
  // Ver TarjetaPrecios: el canvas principal mide y reporta (`onFitChange`,
  // estable); las miniaturas pasan `nivelDensidad` y no miden.
  nivelDensidad?: number;
  onFitChange?:   (resultado: ResultadoDensidad) => void;
  // Miniaturas del picker: dejan el degradé oscuro detrás del encabezado pero
  // omiten la segunda copia desenfocada de la foto (8 renders de foto de más
  // por un blur que a 104px no se distingue).
  sinFranjaDesenfocada?: boolean;
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
  { templateId, fotos, titulo, subtitulo, servicios, nombreNegocio, telefono, profesionalNombre, logoUrl, serie, nota, notaAlineacion, nivelDensidad, onFitChange, sinFranjaDesenfocada = false },
  ref
) {
  const template = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];
  const Layout = template.Component;
  // Zona del encabezado (sobre la foto): la tarjeta empieza debajo de
  // reservaSuperiorEncabezado y la franja desenfocada/degradé cubre
  // alturaZonaEncabezado; ambos salen del mismo módulo que el encabezado.
  const zonaEncabezado = alturaZonaEncabezado(BASE_HEIGHT);

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
            servicios={servicios}
            nota={nota}
            notaAlineacion={notaAlineacion}
            variante={template.cardVariant}
            align={template.align}
            nivelDensidad={nivelDensidad}
            onFitChange={onFitChange}
            reservaInferior={FOOTER_RESERVA}
            reservaSuperior={reservaSuperiorEncabezado(BASE_HEIGHT)}
          />
        </Layout>
        {/* Franja desenfocada detrás del encabezado — misma técnica que
            StoryCanvas: filter:blur() sobre una SEGUNDA copia de la foto (no
            backdrop-filter, que html-to-image no compone). Se vuelve a
            renderizar el mismo Layout (sin tarjeta) a tamaño de canvas
            completo, dentro de un wrapper con overflow:hidden que solo destapa
            la zona del encabezado: así el blur queda alineado píxel a píxel con
            la foto base en las plantillas con foto de fondo; en collage (fondo
            sólido + bloque de fotos arriba) funciona igual y el blur de un color
            plano es inocuo. */}
        {!sinFranjaDesenfocada && (
          <div
            data-testid="historia-precios-banda"
            aria-hidden="true"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: zonaEncabezado, overflow: 'hidden' }}
          >
            <div
              data-testid="historia-precios-banda-copia"
              style={{ position: 'absolute', top: 0, left: 0, width: BASE_WIDTH, height: BASE_HEIGHT, filter: 'blur(16px)' }}
            >
              <Layout fotos={fotos} overlayOpacity={template.tokens.overlayOpacity}>{null}</Layout>
            </div>
          </div>
        )}
        <div
          data-testid="historia-precios-degradado"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: zonaEncabezado,
            background: 'linear-gradient(to bottom, rgba(25,17,20,0.62) 0%, rgba(25,17,20,0) 100%)',
          }}
        />
        <EncabezadoHistoria
          titulo={titulo}
          subtitulo={subtitulo}
          profesionalNombre={profesionalNombre}
          logoUrl={logoUrl}
          serie={serie}
          canvasHeight={BASE_HEIGHT}
        />
        {/* Scrim local detrás del pie: degradé a negro solo en la franja
            inferior (misma altura que la zona reservada), sin oscurecer toda
            la foto. A diferencia del blur de StoryCanvas no se reutiliza esa
            técnica: acá cada plantilla pone una foto distinta abajo, y un
            degradé es un fondo CSS que html-to-image captura sin problema. */}
        <div
          data-testid="historia-precios-scrim"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: FOOTER_RESERVA + 24,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.7) 100%)',
          }}
        />
        {/* Pie sobre la foto, fuera de la tarjeta — mismo componente que la
            historia de turnos (PieContacto). Nombre: SIEMPRE el negocio; la
            profesional va solo en el encabezado. */}
        <div
          data-testid="historia-precios-pie"
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: `0 ${FOOTER_PADDING_X}px ${FOOTER_PADDING_BOTTOM}px`,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <PieContacto nombre={nombreNegocio} telefono={telefono} />
        </div>
      </div>
    </div>
  );
});
