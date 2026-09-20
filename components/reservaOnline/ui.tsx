'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { formatearRestante } from '@/lib/reservaOnline/cuentaRegresiva';
import { IcoReloj } from './iconos';
import { agendaColors as colors, agendaFontSerif, agendaShadows as shadows } from '@/theme/agendaColors';

// Primitivas visuales compartidas por las pantallas publicas de reserva.
// Traducen los tableros del mockup (verde de marca, tarjetas blancas, titulos
// serif, barra inferior fija) a los tokens agendaColors.

export const TOTAL_PASOS = 5;

// Cabecera de los 5 pasos: boton redondo de volver + progreso segmentado con
// "N/5", y debajo el titulo serif con un subtitulo corto opcional.
export function PasoHeader({
  titulo,
  subtitulo,
  paso,
  onVolver,
  pill,
}: {
  titulo: string;
  subtitulo?: string;
  // Cuenta regresiva de la retencion del horario (pasos Datos y Resumen).
  pill?: ReactNode;
  paso: number; // 1..TOTAL_PASOS: cuantos segmentos van rellenos
  onVolver?: () => void;
}) {
  const t = useTranslations('reservaOnline.comun');
  return (
    <header style={{ margin: '0 -20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 6px', minHeight: 40 }}>
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            aria-label={t('volver')}
            style={{
              width: 36, height: 36, borderRadius: 18, flexShrink: 0, cursor: 'pointer', padding: 0,
              background: colors.surface, border: `1px solid ${colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.strong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div
          role="progressbar"
          aria-label={t('pasoDe', { actual: paso, total: TOTAL_PASOS })}
          aria-valuemin={1}
          aria-valuemax={TOTAL_PASOS}
          aria-valuenow={paso}
          style={{ flex: 1, display: 'flex', gap: 5 }}
        >
          {Array.from({ length: TOTAL_PASOS }, (_, i) => (
            <div
              key={i}
              style={{ flex: 1, height: 4, borderRadius: 2, background: i < paso ? colors.primarySolid : colors.border }}
            />
          ))}
        </div>
        <div aria-hidden="true" style={{ fontSize: 12, fontWeight: 600, color: colors.sub, width: 34, textAlign: 'right' }}>
          {paso}/{TOTAL_PASOS}
        </div>
      </div>
      {pill && <div style={{ padding: '8px 20px 0', display: 'flex', justifyContent: 'center' }}>{pill}</div>}
      <div style={{ padding: '14px 20px 14px' }}>
        <h1 style={{ margin: 0, fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 27, lineHeight: 1.15, color: colors.textStrong }}>
          {titulo}
        </h1>
        {subtitulo && (
          <div style={{ fontSize: 14, color: colors.sub, marginTop: 5, lineHeight: 1.45 }}>{subtitulo}</div>
        )}
      </div>
    </header>
  );
}

// Barra inferior fija con degrade hacia el fondo (pegada al borde de la
// columna de 480px): el contenido se desvanece detras del boton.
export function BarraInferior({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        margin: '24px -20px -24px',
        padding: '12px 20px 26px',
        background: `linear-gradient(to top, ${colors.bg} 78%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

// Tintes pastel de los avatares del tablero (no son del tema): rosa, verde salvia, azul.
const TINTES_AVATAR = ['#d9c2c7', '#c5d3c4', '#c8cfe0', '#e6d8bf'];

const tinteDe = (nombre: string): string =>
  TINTES_AVATAR[[...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTES_AVATAR.length];

// Circulo con la inicial (o contenido propio), o una foto real si se pasa
// `fotoUrl` (avatar de la profesional). `anillo` marca la seleccion.
export function Avatar({
  nombre,
  size = 36,
  anillo = false,
  fotoUrl,
  children,
}: {
  nombre: string;
  size?: number;
  anillo?: boolean;
  // Avatar real de la profesional — null/undefined cae a la inicial (o a
  // `children`, si se paso). Un circulo chico es un recorte apropiado para
  // un headshot cuadrado/casi-cuadrado (a diferencia de la portada del
  // salon en EntryScreen, que nunca se recorta en un circulo).
  fotoUrl?: string | null;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size / 2, flexShrink: 0,
        background: tinteDe(nombre), color: colors.textStrong,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        fontFamily: agendaFontSerif, fontSize: Math.round(size * 0.48),
        boxShadow: anillo ? `0 0 0 2px ${colors.primarySolid}` : undefined,
      }}
    >
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        children ?? nombre.trim().charAt(0).toUpperCase()
      )}
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

// Bloque "hueso" de esqueleto de carga: rectangulo con pulso (animacion
// rz-pulse de globals.css). Compartido por todas las pantallas del flujo
// publico para no duplicar la primitiva pantalla por pantalla.
export function Hueso({ w, h, r = 8, style }: { w: number | string; h: number; r?: number; style?: CSSProperties }) {
  return (
    <div
      className="rz-skeleton"
      style={{ width: w, height: h, borderRadius: r, background: colors.divider, ...style }}
    />
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

// Pastilla de la barra superior: "Tu horario esta reservado · mm:ss". Pasa a
// tono ambar cuando queda poco (menos de 2 minutos).
export function HoldPill({ restanteMs }: { restanteMs: number }) {
  const t = useTranslations('reservaOnline.hold');
  const poco = restanteMs < 120_000;
  return (
    <div
      role="timer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
        background: poco ? colors.amberBg : colors.primarySoft, color: poco ? colors.amberFg : colors.primaryDeep,
      }}
    >
      <IcoReloj color={poco ? colors.amberFg : colors.primaryDeep} size={14} />
      {t('pill', { restante: formatearRestante(restanteMs) })}
    </div>
  );
}
