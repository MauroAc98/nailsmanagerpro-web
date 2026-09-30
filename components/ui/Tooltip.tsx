'use client';

import type { ReactElement } from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

// Tooltip sobre @base-ui/react/tooltip (headless, ya instalado — mismo
// paquete que components/ui/button.tsx) en vez del tooltip nativo del
// navegador (sin estilo, inconsistente entre navegadores). `children` es el
// elemento disparador tal cual: Base UI lo clona vía su prop `render` en vez
// de envolverlo en un <button> propio, así el trigger conserva su propio
// tag (ej. un <p>) y su estilo.
export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={300} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={8}>
          <TooltipPrimitive.Popup
            style={{
              backgroundColor: colors.textStrong, color: '#fff',
              fontSize: 12, fontWeight: 400, lineHeight: 1.4,
              padding: '8px 11px', borderRadius: 10, boxShadow: shadows.card,
              maxWidth: 220,
            }}
          >
            {label}
            <TooltipPrimitive.Arrow
              style={{ width: 8, height: 8, backgroundColor: colors.textStrong, transform: 'rotate(45deg)' }}
            />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
