'use client';

import { useTranslations } from 'next-intl';
import { Check, CheckCheck } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { estadoWhatsapp, type EstadoWhatsapp } from '@/lib/estadoWhatsapp';

// Azul de las tildes de "leido" de WhatsApp. No hay un token de color azul en
// la paleta de la agenda, asi que vive aca; se ve bien sobre fondo claro y
// oscuro (la tilde no lleva fondo propio).
export const AZUL_LEIDO = '#34a0e8';

export const COLOR_ESTADO_WHATSAPP: Record<EstadoWhatsapp, string> = {
  enviado: colors.subtext,
  entregado: colors.success,
  leido: AZUL_LEIDO,
  fallo: colors.danger,
};

// Glifo de cada estado. Se distinguen tambien por la FORMA (una tilde, dos
// tildes, signo de exclamacion), no solo por el color.
export function GlifoEstadoWhatsapp({ estado, size, strokeWidth = 2.5 }: {
  estado: EstadoWhatsapp;
  size: number;
  strokeWidth?: number;
}) {
  const color = COLOR_ESTADO_WHATSAPP[estado];
  if (estado === 'fallo') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth + 0.5} strokeLinecap="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="14" />
        <line x1="12" y1="19" x2="12.01" y2="19" />
      </svg>
    );
  }
  const Icono = estado === 'enviado' ? Check : CheckCheck;
  return <Icono size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />;
}

const TAMANO = 15;
const BORDE = 2;

// Insignia chica en la esquina del icono de WhatsApp con el estado del ultimo
// mensaje automatico. No muestra nada si no hay mensaje. No captura toques
// (pointer-events: none) para no cambiar el area de click del enlace de abajo.
// `desfase`: cuanto se separa de la esquina inferior derecha del contenedor.
export function BadgeEstadoWhatsapp({ status, desfase = -1, fondo = colors.surface }: {
  status: string | null | undefined;
  desfase?: number;
  fondo?: string;
}) {
  const t = useTranslations('common.EstadoWhatsapp');
  const estado = estadoWhatsapp(status);
  if (!estado) return null;

  return (
    <span
      role="img"
      aria-label={t(estado)}
      style={{
        position: 'absolute', bottom: desfase, right: desfase,
        width: TAMANO, height: TAMANO, boxSizing: 'border-box',
        borderRadius: TAMANO / 2, border: `${BORDE}px solid ${fondo}`, backgroundColor: fondo,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <GlifoEstadoWhatsapp estado={estado} size={TAMANO - BORDE * 2 - 1} strokeWidth={3} />
    </span>
  );
}
