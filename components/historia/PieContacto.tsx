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

// PieContacto — pie compartido de las historias que genera la app (turnos y
// precios): línea divisoria + CTA "Reservá tu turno" + una línea con nombre,
// guion largo y teléfono. Texto blanco directo sobre la foto (no dentro de una
// tarjeta), por eso las sombras de texto. Es UN solo componente para que las
// dos historias no se desalineen otra vez. Devuelve un fragmento (divisor y pie
// como hermanos) para que el padre flex de StoryCanvas siga repartiendo igual.
export function PieContacto({ nombre, telefono, lineaRef, pieRef }: Props) {
  const t = useTranslations('historia.PieContacto');
  return (
    <>
      <div ref={lineaRef} data-testid="story-linea" style={{ height: 1, background: 'rgba(255,255,255,0.25)', margin: '0 0 10px' }} />
      <div ref={pieRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{
          fontFamily: agendaFontSerif, fontStyle: 'italic', fontWeight: 400, fontSize: 16,
          color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.85)',
        }}>
          {t('reserveCta')}
        </span>
        {(telefono || nombre) && (
          // Texto corrido en UNA línea (no cajas flex): nombre en serif, guion
          // y teléfono comparten la línea base. Un nombre largo baja de renglón
          // antes que cortarse; el teléfono nunca se parte.
          <div style={{
            textAlign: 'center', maxWidth: '100%', marginTop: 2, fontSize: 12, lineHeight: '16px',
            color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}>
            {nombre && <span style={{ fontFamily: agendaFontSerif }}>{nombre}</span>}
            {nombre && telefono && (
              <span aria-hidden style={{ margin: '0 8px', color: 'rgba(255,255,255,0.75)' }}>—</span>
            )}
            {telefono && (
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                +{phoneUtils.formatDisplay(telefono)}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
