'use client';

import { useTranslations } from 'next-intl';
import { Tag } from 'lucide-react';
import { agendaFontSerif } from '@/theme/agendaColors';
import { nombreMes } from '@/lib/dateFormat';
import { safeAreaInsets } from '@/lib/historia/safeArea';
import { FitText } from '@/components/historia/FitText';

// Medidas del encabezado sobre la foto. Constantes (no medidas) y compartidas
// con el canvas y la tarjeta: la tarjeta empieza justo debajo de
// reservaSuperiorEncabezado(), así que el encabezado y la tarjeta no se pueden
// desfasar. El alto es el del recuadro porque título + línea (~36px) siempre
// entran en él: ambos van en UNA línea (FitText) y el alto no depende del texto.
export const ENCABEZADO_TILE = 44;
export const ENCABEZADO_GAP = 4;
const ENCABEZADO_PADDING_X = 18;

// Cuánto se sube el encabezado respecto del borde de la safe area superior
// (11%): ahí queda un poco alto sobre la foto, y 30px de subida siguen
// librando el chrome de Instagram/WhatsApp (avatar + barra de progreso).
export const ENCABEZADO_SUBIDA = 30;

// Borde superior del encabezado (px desde el tope del canvas).
function topEncabezado(canvasHeight: number): number {
  return Math.max(0, safeAreaInsets(canvasHeight).top - ENCABEZADO_SUBIDA);
}

// Distancia desde el borde superior del canvas hasta donde puede empezar la
// tarjeta: safe area + encabezado + una separación chica (la tarjeta suma además
// su propio padding superior).
export function reservaSuperiorEncabezado(canvasHeight: number): number {
  return topEncabezado(canvasHeight) + ENCABEZADO_TILE + ENCABEZADO_GAP;
}

// Alto de la franja desenfocada + degradé detrás del encabezado: mismo cálculo
// que tituloZonaAlto de la historia de turnos (StoryCanvas).
export function alturaZonaEncabezado(canvasHeight: number): number {
  return topEncabezado(canvasHeight) + Math.round(canvasHeight * 0.10);
}

const SOMBRA = '0 2px 6px rgba(0,0,0,0.85)';

interface Props {
  // "Lista de precios" (fijo, resuelto por el caller).
  titulo:       string;
  // Nombre de la categoría (modo "una por categoría"): pasa a ser el título y
  // `titulo` baja a la línea chica.
  subtitulo?:   string;
  // Profesional efectiva ("con Ana"), siempre que haya una.
  profesionalNombre?: string;
  // Foto del recuadro, ya proxiada y horneada a data URL (useFotoEncabezado);
  // sin foto: recuadro translúcido con un ícono.
  logoUrl?:     string | null;
  // Posición en la serie ("1/4"); solo viene con más de una historia.
  serie?:       { actual: number; total: number };
  canvasHeight: number;
}

// EncabezadoHistoria — encabezado de la historia de precios, directamente sobre
// la foto (no dentro de la tarjeta), con el mismo patrón que la historia de
// turnos (StoryCanvas): recuadro 44x44, título serif y UNA línea chica, todo en
// blanco con sombra. Colores fijos (rgba/hex): html-to-image descarta las custom
// properties. La foto va sin `filter`: en Safari un filtro dentro de lo capturado
// dejaba la historia entera negra.
export function EncabezadoHistoria({ titulo, subtitulo, profesionalNombre, logoUrl, serie, canvasHeight }: Props) {
  // Mismo texto "con {nombre}" que la historia de turnos (una sola fuente).
  const tStory = useTranslations('historia.StoryCanvas');
  const tituloGrande = subtitulo || titulo;
  const ahora = new Date();
  const periodo = `${nombreMes(ahora, 'long')} ${ahora.getFullYear()}`;
  const linea = [
    subtitulo ? titulo : null,
    profesionalNombre ? tStory('withProfessional', { nombre: profesionalNombre }) : null,
    periodo,
  ].filter(Boolean).join(' · ');

  return (
    <div
      data-testid="encabezado-historia"
      style={{
        position: 'absolute', left: 0, right: 0, top: topEncabezado(canvasHeight), height: ENCABEZADO_TILE,
        padding: `0 ${ENCABEZADO_PADDING_X}px`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      {logoUrl ? (
        <img
          data-testid="encabezado-foto"
          src={logoUrl}
          alt=""
          style={{
            flexShrink: 0, width: ENCABEZADO_TILE, height: ENCABEZADO_TILE, borderRadius: 12, objectFit: 'cover',
            border: '1.5px solid rgba(255,255,255,0.6)',
          }}
        />
      ) : (
        <span
          data-testid="encabezado-icono"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, width: ENCABEZADO_TILE, height: ENCABEZADO_TILE, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Tag size={20} color="#fff" strokeWidth={2} />
        </span>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <FitText
          testId="encabezado-titulo"
          text={tituloGrande}
          maxFontSize={20}
          minFontSize={13}
          style={{
            fontFamily: agendaFontSerif, fontWeight: 400, color: '#fff', textAlign: 'left',
            letterSpacing: '-0.02em', lineHeight: 1.05, textShadow: SOMBRA,
          }}
        />
        <div style={{ marginTop: 4 }}>
          <FitText
            testId="encabezado-linea"
            text={linea}
            maxFontSize={11}
            minFontSize={9}
            style={{
              fontWeight: 400, color: 'rgba(255,255,255,0.9)', textShadow: SOMBRA, textOverflow: 'ellipsis',
            }}
          />
        </div>
      </div>
      {serie && (
        <span
          data-testid="encabezado-serie"
          style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1,
            backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff',
            borderRadius: 999, padding: '4px 9px',
          }}
        >
          {`${serie.actual}/${serie.total}`}
        </span>
      )}
    </div>
  );
}
