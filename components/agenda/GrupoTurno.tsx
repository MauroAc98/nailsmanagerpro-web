'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import type { BarraGrupo } from '@/lib/gruposTurnos';

// Piezas visuales de un turno que es parte de un grupo (varias profesionales).

export function IconoGrupo() {
  const t = useTranslations('agenda.GrupoTurno');
  return (
    <span aria-label={t('enlace')} role="img" style={{ display: 'flex', flexShrink: 0 }}>
      <Link2 size={14} color={colors.primaryDeep} strokeWidth={2.2} />
    </span>
  );
}

// Barra en el margen izquierdo que une la tarjeta con la de arriba y/o la de abajo (el gap entre tarjetas es 10px).
export function ConBarra({ barra, children }: { barra?: BarraGrupo; children: ReactNode }) {
  if (!barra) return <>{children}</>;
  return (
    <div style={{ position: 'relative' }}>
      <span
        data-grupo-barra=""
        style={{
          position: 'absolute', left: -9, width: 3, borderRadius: 2, backgroundColor: colors.primarySolid,
          top: barra.arriba ? -10 : 18, bottom: barra.abajo ? -10 : 18,
        }}
      />
      {children}
    </div>
  );
}
