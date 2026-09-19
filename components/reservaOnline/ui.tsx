'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaFontSerif, agendaShadows as shadows } from '@/theme/agendaColors';

// Primitivas visuales compartidas por las pantallas publicas de reserva.
// Traducen los tableros del mockup (verde de marca, tarjetas blancas, titulos
// serif, barra inferior fija) a los tokens agendaColors.

export const TOTAL_PASOS = 5;

export function PasoHeader({
  titulo,
  paso,
  onVolver,
}: {
  titulo: string;
  paso: number; // 1..TOTAL_PASOS: cuantos segmentos van rellenos
  onVolver?: () => void;
}) {
  const t = useTranslations('reservaOnline.comun');
  return (
    <header>
      <div style={{ padding: '4px 0 2px', minHeight: 30 }}>
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            aria-label={t('volver')}
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
      </div>
      <h1 style={{ margin: '4px 0 10px', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong }}>
        {titulo}
      </h1>
      <div style={{ display: 'flex', gap: 6, paddingBottom: 14 }} aria-hidden="true">
        {Array.from({ length: TOTAL_PASOS }, (_, i) => (
          <div
            key={i}
            style={{ flex: 1, height: 4, borderRadius: 2, background: i < paso ? colors.primarySolid : colors.border }}
          />
        ))}
      </div>
    </header>
  );
}

// Barra inferior fija (pegada al borde de la columna de 480px).
export function BarraInferior({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        margin: '24px -16px -24px',
        padding: '14px 20px 26px',
        background: colors.bg,
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      {children}
    </div>
  );
}

export function BotonPrimario({
  children,
  onClick,
  disabled,
  fondo,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fondo?: string;
}) {
  const estilo: CSSProperties = {
    width: '100%',
    height: 52,
    borderRadius: 14,
    border: 'none',
    background: fondo ?? colors.primarySolid,
    color: colors.primaryFg,
    fontSize: 16,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={estilo}>
      {children}
    </button>
  );
}

export function Tarjeta({ children, estilo }: { children: ReactNode; estilo?: CSSProperties }) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        boxShadow: shadows.card,
        padding: 16,
        ...estilo,
      }}
    >
      {children}
    </div>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: colors.sub, textTransform: 'uppercase', margin: '4px 0 8px' }}>
      {children}
    </div>
  );
}

export function Mensaje({ children, tono = 'sub' }: { children: ReactNode; tono?: 'sub' | 'error' }) {
  return (
    <p
      role={tono === 'error' ? 'alert' : undefined}
      style={{ fontSize: 14, lineHeight: 1.5, margin: '12px 0', color: tono === 'error' ? colors.danger : colors.sub }}
    >
      {children}
    </p>
  );
}
