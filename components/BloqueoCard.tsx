'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { SWIPE_PEEK, SWIPE_REVEAL, useSwipeToDelete } from '@/hooks/useSwipeToDelete';

interface ProfesionalBloqueo {
  nombre: string;
  apellido?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
}

interface Props {
  fecha: string;
  horario: string;
  esHorarioPuntual: boolean;
  motivo?: string | null;
  nombreProfesional: string;
  profesional?: ProfesionalBloqueo | null;
  onDelete: () => void;
}

// Glyph de local/negocio — marca un bloqueo que afecta a todo el salón, sin
// profesional puntual asignada.
function IconoLocal() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colors.subtext} strokeWidth="2">
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
      <path d="M3 21h18" />
    </svg>
  );
}

export default function BloqueoCard({
  fecha, horario, esHorarioPuntual, motivo, nombreProfesional, profesional, onDelete,
}: Props) {
  const t = useTranslations('configuracion.BloqueosPage');
  // Sin pantalla de edición: tocar la card cerrada no hace nada.
  const { cardRef, handlers } = useSwipeToDelete();

  const colorPunto = profesional ? (profesional.color || colors.primary) : colors.subtext;

  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 14,
        border: `1px solid ${colors.border}`, boxShadow: shadows.card,
        backgroundColor: colors.surface,
      }}
    >
      {/* Panel de eliminar — detrás, se revela con el swipe. */}
      <div
        onClick={onDelete}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', justifyContent: 'flex-end',
        }}
      >
        <div style={{
          width: SWIPE_REVEAL, height: '100%',
          backgroundColor: colors.dangerBg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.danger, letterSpacing: 0.5 }}>
            {t('delete')}
          </span>
        </div>
      </div>

      {/* Foreground deslizable — todo el contenido de la card. */}
      <div
        ref={cardRef}
        {...handlers}
        style={{
          position: 'relative', transform: `translateX(${-SWIPE_PEEK}px)`,
          display: 'flex', alignItems: 'center', gap: 12,
          backgroundColor: colors.surface,
          padding: `14px 16px 14px ${16 + SWIPE_PEEK}px`, cursor: 'default', userSelect: 'none',
        }}
      >
        {profesional ? (
          <span data-testid="avatar-profesional" style={{ display: 'flex', flexShrink: 0 }}>
            <AvatarProfesional
              nombre={profesional.nombre}
              apellido={profesional.apellido}
              color={profesional.color}
              avatarUrl={profesional.avatarUrl}
              size={36}
              fontSize={13}
            />
          </span>
        ) : (
          <span
            data-testid="icono-local"
            style={{
              width: 36, height: 36, borderRadius: 18, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.surfaceSubtle,
            }}
          >
            <IconoLocal />
          </span>
        )}

        {/* minWidth: 0 — sin esto los spans con ellipsis no se achican por
            debajo de su ancho de contenido y el ellipsis nunca dispara. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>
            {fecha}
            <span
              data-testid="horario-bloqueo"
              style={{
                fontSize: 12,
                fontWeight: esHorarioPuntual ? 600 : 400,
                color: esHorarioPuntual ? colors.amberFg : colors.subtext,
              }}
            >
              {'  ·  '}{horario}
            </span>
          </p>
          {motivo && (
            <p
              data-testid="motivo-bloqueo"
              style={{
                margin: '2px 0 0', fontSize: 12, color: colors.subtext,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {motivo}
            </p>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3, flexShrink: 0,
              backgroundColor: colorPunto,
            }} />
            <span style={{
              fontSize: 11, color: colors.subtext,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {nombreProfesional}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
