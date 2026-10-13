import type { Ref } from 'react';
import { useTranslations } from 'next-intl';
import { agendaFontSerif } from '@/theme/agendaColors';
import { phoneUtils } from '@/lib/phoneUtils';

interface Props {
  // Nombre del negocio o de la profesional elegida; vacío/null se omite.
  nombre?: string | null;
  // Teléfono crudo (User.telefono); vacío/null se omite.
  telefono?: string | null;
  // Refs a los 2 nodos que StoryCanvas mide para su zona de blur: la línea
  // divisoria y el bloque CTA + contacto.
  lineaRef?: Ref<HTMLDivElement>;
  pieRef?: Ref<HTMLDivElement>;
}

const SOMBRA = '0 2px 6px rgba(0,0,0,0.85)';

// PieContacto — pie compartido de las historias que genera la app (turnos y
// precios): línea divisoria + etiqueta "Reservá tu turno" + nombre del negocio
// en serif a la izquierda y teléfono a la derecha, pegado al borde. Espejo del
// encabezado de la historia de turnos (mismo eje izquierdo, misma etiqueta
// chica espaciada y mismo degradado en la línea). Texto blanco directo sobre la
// foto (no dentro de una tarjeta), por eso las sombras de texto. Es UN solo
// componente para que las dos historias no se desalineen otra vez. Devuelve un
// fragmento (divisor y pie como hermanos) para que el padre flex de StoryCanvas
// siga repartiendo igual.
export function PieContacto({ nombre, telefono, lineaRef, pieRef }: Props) {
  const t = useTranslations('historia.PieContacto');
  const tel = telefono ? `+${phoneUtils.formatDisplay(telefono)}` : null;
  return (
    <>
      <div
        ref={lineaRef}
        data-testid="story-linea"
        style={{ height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.45), rgba(255,255,255,0.04))', margin: '0 0 12px' }}
      />
      <div ref={pieRef} style={{ display: 'flex', alignItems: 'flex-end', gap: 12, textShadow: SOMBRA }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 8, fontWeight: 700,
            letterSpacing: '0.2em', lineHeight: '10px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap',
          }}>
            <span>{t('reserveCta')}</span>
          </div>
          {/* El nombre baja de renglón antes que cortarse. Sin nombre, el
              teléfono ocupa su lugar en grande y no queda nada a la derecha. */}
          {nombre ? (
            <div style={{ marginTop: 5, fontFamily: agendaFontSerif, fontSize: 20, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}>
              {nombre}
            </div>
          ) : tel ? (
            <div style={{ marginTop: 5, fontSize: 16, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', color: '#fff' }}>
              {tel}
            </div>
          ) : null}
        </div>
        {nombre && tel && (
          <span style={{
            flexShrink: 0, paddingBottom: 3, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: '#fff',
          }}>
            {tel}
          </span>
        )}
      </div>
    </>
  );
}
