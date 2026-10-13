'use client';

import { Fragment, type ReactNode } from 'react';
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
// Margen lateral del encabezado. También lo usa el pie (HistoriaPreciosCanvas)
// para que los dos arranquen en el mismo eje izquierdo.
export const ENCABEZADO_PADDING_X = 18;

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

// Anillo de la insignia: box-shadow (nunca `filter`), igual que la de turnos.
const ANILLO = '0 0 0 1.5px rgba(255,255,255,0.85), 0 0 0 4.5px rgba(255,255,255,0.22)';

// "Uñas y Pestañas" -> "Uñas y " + <em>Pestañas</em>: la palabra clave en
// cursiva, igual que "Turnos de <em>Lash</em>" en la historia de turnos.
function conUltimaPalabraEnCursiva(texto: string) {
  const i = texto.lastIndexOf(' ');
  return (
    <>
      {i >= 0 ? texto.slice(0, i + 1) : ''}
      <em style={{ fontStyle: 'italic' }}>{i >= 0 ? texto.slice(i + 1) : texto}</em>
    </>
  );
}

// EncabezadoHistoria — encabezado de la historia de precios, directamente sobre
// la foto (no dentro de la tarjeta), espejo del de la historia de turnos
// (StoryCanvas): etiqueta chica espaciada arriba, título serif de 24px con la
// palabra clave en cursiva y la insignia circular como sello a la derecha, todo
// en blanco con sombra. Etiqueta (10px) + 5px + título (~25px) entran en el
// alto de la insignia (44px), así el alto no depende del texto. Colores fijos
// (rgba/hex): html-to-image descarta las custom properties. La foto va sin
// `filter`: en Safari un filtro dentro de lo capturado dejaba la historia
// entera negra.
export function EncabezadoHistoria({ titulo, subtitulo, profesionalNombre, logoUrl, serie, canvasHeight }: Props) {
  // Mismo texto "con {nombre}" (con el nombre en negrita) que la historia de turnos.
  const tStory = useTranslations('historia.StoryCanvas');
  const ahora = new Date();
  const periodo = `${nombreMes(ahora, 'long')} ${ahora.getFullYear()}`;
  const enCursiva = (chunks: ReactNode) => <em style={{ fontStyle: 'italic' }}>{chunks}</em>;
  // Etiqueta: Período — con Ana, unidas por una rayita (como la de turnos); la
  // posición en la serie ("1/4") va al final, pegada a la derecha.
  const piezas = [
    periodo,
    profesionalNombre
      ? tStory.rich('withProfessionalRich', {
        nombre: profesionalNombre,
        b: (chunks) => <b style={{ color: '#fff', fontWeight: 700 }}>{chunks}</b>,
      })
      : null,
  ].filter(Boolean);

  return (
    <div
      data-testid="encabezado-historia"
      style={{
        position: 'absolute', left: 0, right: 0, top: topEncabezado(canvasHeight), height: ENCABEZADO_TILE,
        padding: `0 ${ENCABEZADO_PADDING_X}px`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <FitText
          testId="encabezado-linea"
          text={(
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {piezas.map((pieza, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span
                      aria-hidden
                      style={{ flexShrink: 0, width: 16, height: 1, margin: '0 8px', background: 'rgba(255,255,255,0.55)' }}
                    />
                  )}
                  <span style={{ whiteSpace: 'nowrap' }}>{pieza}</span>
                </Fragment>
              ))}
              {serie && (
                <>
                  <span style={{ flex: 1, minWidth: 8 }} />
                  <span data-testid="encabezado-serie" style={{ flexShrink: 0, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                    {`${serie.actual}/${serie.total}`}
                  </span>
                </>
              )}
            </span>
          )}
          maxFontSize={8}
          minFontSize={6}
          style={{
            fontWeight: 700, letterSpacing: '0.2em', lineHeight: '10px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.72)', textShadow: SOMBRA, textOverflow: 'ellipsis',
          }}
        />
        <div style={{ marginTop: 5 }}>
          <FitText
            testId="encabezado-titulo"
            text={subtitulo
              ? tStory.rich('pricesTitleFor', { categoria: subtitulo, em: enCursiva })
              : conUltimaPalabraEnCursiva(titulo)}
            maxFontSize={24}
            minFontSize={13}
            style={{
              fontFamily: agendaFontSerif, fontWeight: 400, color: '#fff', textAlign: 'left',
              letterSpacing: '-0.025em', lineHeight: 1.05, textShadow: SOMBRA,
            }}
          />
        </div>
      </div>
      {logoUrl ? (
        <img
          data-testid="encabezado-foto"
          src={logoUrl}
          alt=""
          style={{
            flexShrink: 0, width: ENCABEZADO_TILE, height: ENCABEZADO_TILE, borderRadius: '50%', objectFit: 'cover',
            boxShadow: ANILLO,
          }}
        />
      ) : (
        <span
          data-testid="encabezado-icono"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, width: ENCABEZADO_TILE, height: ENCABEZADO_TILE, borderRadius: '50%',
            boxShadow: ANILLO,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))',
          }}
        >
          <Tag size={20} color="#fff" strokeWidth={2} />
        </span>
      )}
    </div>
  );
}
