'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link2 } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { listaDeNombres } from '@/lib/reservaOnline/listaDeNombres';
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

// "Servicios · con Laura": el "con ..." cede primero cuando falta lugar.
export function LineaServicios({ servicios, otros }: { servicios: string; otros: string[] }) {
  const t = useTranslations('agenda.GrupoTurno');
  const locale = useLocale();
  const corta = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
  if (otros.length === 0) return <>{servicios}</>;
  return (
    <span style={{ display: 'flex', minWidth: 0 }}>
      <span style={{ ...corta, flexShrink: 1 }}>{servicios}</span>
      <span style={{ flexShrink: 0 }}>&nbsp;·&nbsp;</span>
      <span style={{ ...corta, flexShrink: 100 }}>{t('con', { nombres: listaDeNombres(otros, locale) })}</span>
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
