'use client';

import { useTranslations } from 'next-intl';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import type { BloqueoVinculo } from '@/lib/pro/acceso';
import { MOTIVOS_VINCULO } from '@/lib/pro/errores';
import type { ProVinculo } from '@/lib/pro/tipos';
import { agendaColors } from '@/theme/agendaColors';

interface Props {
  vinculo: ProVinculo;
  // Bloqueo efectivo (lib/pro/acceso.bloqueoEfectivo): null = se puede elegir.
  bloqueo: BloqueoVinculo | null;
  // Etiqueta corta a la derecha ("Disponible", "Actual").
  etiqueta?: string;
  actual?: boolean;
  onElegir: (id: number) => void;
}

const truncar = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

// Fila de un negocio, compartida por la lista de /negocios y por el sheet de
// cambio. Un negocio bloqueado se muestra deshabilitado (no se oculta) para que
// la persona vea por qué. aria-disabled y no `disabled`: sigue siendo enfocable
// y un lector de pantalla lee el motivo.
export function FilaVinculo({ vinculo, bloqueo, etiqueta, actual = false, onElegir }: Props) {
  const t = useTranslations('profesionales.Motivo');
  const bloqueado = bloqueo !== null;
  const { nombre, apellido, avatar_url: avatarUrl } = vinculo.profesional;
  const motivo = bloqueo?.motivo != null && MOTIVOS_VINCULO.includes(bloqueo.motivo) ? bloqueo.motivo : 'generico';

  return (
    <button
      type="button"
      aria-disabled={bloqueado ? true : undefined}
      aria-current={actual ? true : undefined}
      onClick={() => {
        if (!bloqueado) onElegir(vinculo.id);
      }}
      style={{
        minHeight: 44,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        textAlign: 'left',
        borderRadius: 12,
        border: `1px solid ${actual ? agendaColors.primaryDeep : agendaColors.fieldBorder}`,
        backgroundColor: agendaColors.surface,
        color: agendaColors.strong,
        cursor: bloqueado ? 'default' : 'pointer',
        opacity: bloqueado ? 0.65 : 1,
      }}
    >
      <AvatarProfesional nombre={nombre} apellido={apellido} avatarUrl={avatarUrl} size={40} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...truncar, fontSize: 16, fontWeight: 600 }}>{vinculo.negocioNombre}</span>
        <span style={{ ...truncar, fontSize: 14 }}>{[nombre, apellido].filter(Boolean).join(' ')}</span>
        {bloqueado && <span style={{ fontSize: 13, color: agendaColors.amberFg }}>{t(motivo)}</span>}
      </span>
      {!bloqueado && etiqueta !== undefined && (
        <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: agendaColors.primaryDeep }}>{etiqueta}</span>
      )}
    </button>
  );
}
