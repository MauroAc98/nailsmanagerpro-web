'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors } from '@/theme/agendaColors';

const tramo = (activo: boolean) =>
  ({
    flex: 1, minHeight: 44, borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 14,
    fontWeight: activo ? 700 : 600,
    color: activo ? colors.strong : colors.sub,
    background: activo ? colors.surface : 'none',
    boxShadow: activo ? '0 1px 3px rgba(43, 34, 38, 0.18)' : 'none',
  }) as const;

// Bloque unico "Quien te atiende": reemplaza al selector de arriba y al link de
// "elegir quien atiende cada servicio". Con 2+ servicios que una misma persona
// puede hacer juntos, un control segmentado deja ver las dos opciones a la vez;
// debajo (children) va lo que corresponda al modo elegido.
export function QuienTeAtiende({
  puedeElegirModo,
  porServicio,
  onModo,
  sinPersonaUnica,
  aviso,
  children,
}: {
  // Muestra el control "Una persona" / "Una por servicio".
  puedeElegirModo: boolean;
  porServicio: boolean;
  onModo: (porServicio: boolean) => void;
  // Ninguna persona hace todos los servicios juntos: no hay control, se explica por que.
  sinPersonaUnica: boolean;
  // Aviso de una linea (p. ej. la elegida ya no hace el servicio); se va al tocar una opcion.
  aviso?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations('reservaOnline');
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
        {t('horario.quienAtiende')}
      </p>
      {puedeElegirModo && (
        <div
          style={{
            display: 'flex', gap: 3, padding: 3, marginBottom: 12, borderRadius: 14,
            background: colors.surface2, border: `1px solid ${colors.border}`,
          }}
        >
          <button type="button" aria-pressed={!porServicio} onClick={() => onModo(false)} style={tramo(!porServicio)}>
            {t('horario.unaPersona')}
          </button>
          <button type="button" aria-pressed={porServicio} onClick={() => onModo(true)} style={tramo(porServicio)}>
            {t('horario.unaPorServicio')}
          </button>
        </div>
      )}
      {sinPersonaUnica && (
        <p
          style={{
            margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
            color: colors.text, background: colors.surface, border: `1px solid ${colors.hairline}`,
          }}
        >
          {t('horario.personasDistintas')}
        </p>
      )}
      {children}
      {aviso && (
        <p
          role="status"
          style={{
            margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
            color: colors.text, background: colors.surface, border: `1px solid ${colors.hairline}`,
          }}
        >
          {aviso}
        </p>
      )}
    </div>
  );
}
