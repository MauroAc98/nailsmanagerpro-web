'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows } from '@/theme/agendaColors';

const tramo = (activo: boolean) =>
  ({
    flex: 1, minHeight: 44, minWidth: 0, borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: activo ? 700 : 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    color: activo ? colors.strong : colors.sub,
    background: activo ? colors.surface : 'none',
    boxShadow: activo ? '0 1px 3px rgba(43, 34, 38, 0.18)' : 'none',
  }) as const;

const icono = { width: 16, height: 16, flexShrink: 0 } as const;

function IconoUna() {
  return (
    <svg {...icono} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="5.5" r="2.6" />
      <path d="M2.8 13.5c.6-2.4 2.6-3.7 5.2-3.7s4.6 1.3 5.2 3.7" />
    </svg>
  );
}

function IconoVarias() {
  return (
    <svg {...icono} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="5.6" cy="6" r="2.2" />
      <circle cx="11" cy="6.6" r="1.9" />
      <path d="M1.6 13c.5-2 2-3 4-3s3.5 1 4 3M10 10.2c2 0 3.7.9 4.4 2.8" />
    </svg>
  );
}

const avisoStyle = {
  margin: 0, padding: '10px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
  color: colors.text, background: colors.primarySoft,
} as const;

// Bloque unico "Quien te atiende": una tarjeta con el titulo, el resumen de la
// eleccion (a la derecha) y, con 2+ servicios que una misma persona puede hacer
// juntos, un control segmentado con una linea que explica el efecto de cada modo.
// Debajo (children) va lo que corresponda al modo elegido.
export function QuienTeAtiende({
  puedeElegirModo,
  porServicio,
  onModo,
  sinPersonaUnica,
  resumen,
  aviso,
  children,
}: {
  // Muestra el control "Una persona" / "Una por servicio".
  puedeElegirModo: boolean;
  porServicio: boolean;
  onModo: (porServicio: boolean) => void;
  // Ninguna persona hace todos los servicios juntos: no hay control, se explica por que.
  sinPersonaUnica: boolean;
  // Lo elegido hoy en una linea corta ("Con Ana y Lucía"); no se muestra si falta.
  resumen?: string | null;
  // Aviso de una linea (p. ej. la elegida ya no hace el servicio); se va al tocar una opcion.
  aviso?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations('reservaOnline');
  return (
    <section
      style={{
        display: 'flex', flexDirection: 'column', gap: 14, padding: 16, marginBottom: 14, borderRadius: 22,
        background: colors.surface, border: `1px solid ${colors.border}`, boxShadow: agendaShadows.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.strong }}>{t('horario.quienAtiende')}</h3>
        {resumen && (
          <span style={{ minWidth: 0, textAlign: 'right', fontSize: 12, fontWeight: 600, color: colors.primaryDeep }}>
            {resumen}
          </span>
        )}
      </div>
      {puedeElegirModo && (
        <>
          <div
            role="group"
            aria-label={t('horario.quienAtiende')}
            style={{
              display: 'flex', gap: 3, padding: 3, borderRadius: 14,
              background: colors.surface2, border: `1px solid ${colors.hairline}`,
            }}
          >
            <button type="button" aria-pressed={!porServicio} onClick={() => onModo(false)} style={tramo(!porServicio)}>
              <IconoUna />
              {t('horario.unaPersona')}
            </button>
            <button type="button" aria-pressed={porServicio} onClick={() => onModo(true)} style={tramo(porServicio)}>
              <IconoVarias />
              {t('horario.unaPorServicio')}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: colors.sub }}>
            {porServicio ? t('horario.ayudaPorServicio') : t('horario.ayudaUnaPersona')}
          </p>
        </>
      )}
      {sinPersonaUnica && <p style={avisoStyle}>{t('horario.personasDistintas')}</p>}
      {children}
      {aviso && (
        <p role="status" style={avisoStyle}>
          {aviso}
        </p>
      )}
    </section>
  );
}
