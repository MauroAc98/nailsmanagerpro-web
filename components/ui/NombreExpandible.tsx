'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

// Texto que se recorta (1 linea con "…" o line-clamp de N) y, SOLO cuando de
// verdad queda recortado, se puede tocar para ver el texto completo en un
// popover. Reemplaza al hover Tooltip, que no existe en la PWA mobile.
//
// Recortado: el toque abre el popover y NO sube al padre (click ni touch*),
// asi no abre la pantalla de edicion ni dispara el swipe de la card. Entra
// completo: no se agrega ningun handler y el toque se comporta como siempre.
export function NombreExpandible({
  texto, children, lineas = 1, style,
}: {
  // Texto completo que muestra el popover.
  texto: string;
  // Contenido visible si difiere de `texto` (ej. con un sufijo "y 1 mas").
  children?: ReactNode;
  lineas?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [recortado, setRecortado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setRecortado(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  }, []);

  useLayoutEffect(() => {
    medir();
    window.addEventListener('resize', medir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (ref.current) ro?.observe(ref.current);
    return () => {
      window.removeEventListener('resize', medir);
      ro?.disconnect();
    };
  }, [medir, texto, children, lineas]);

  const recorte: CSSProperties = lineas > 1
    ? {
        display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', overflowWrap: 'anywhere',
      }
    : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const frenar = recortado ? (e: { stopPropagation: () => void }) => e.stopPropagation() : undefined;

  return (
    <Popover.Root open={abierto && recortado} onOpenChange={setAbierto}>
      <Popover.Trigger
        nativeButton={false}
        render={
          <p
            ref={ref}
            onClick={frenar}
            onTouchStart={frenar}
            onTouchMove={frenar}
            onTouchEnd={frenar}
            style={{ margin: 0, minWidth: 0, ...style, ...recorte, cursor: recortado ? 'pointer' : style?.cursor }}
          />
        }
      >
        {children ?? texto}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={8}>
          <Popover.Popup
            style={{
              backgroundColor: colors.textStrong, color: '#fff',
              fontSize: 13, fontWeight: 400, lineHeight: 1.4, fontStyle: 'normal',
              padding: '8px 11px', borderRadius: 10, boxShadow: shadows.card,
              maxWidth: 260, overflowWrap: 'anywhere',
            }}
          >
            {texto}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
