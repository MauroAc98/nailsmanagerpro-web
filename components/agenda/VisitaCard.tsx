'use client';

import { useTranslations } from 'next-intl';
import { Check, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { formatearDuracion } from '@/lib/duracion';
import { reservaOnlineHabilitada } from '@/lib/reservaOnline/flag';
import { BadgeReservaOnline } from '@/components/reservaOnline/BadgeReservaOnline';
import { NombreExpandible } from '@/components/ui/NombreExpandible';
import type { Turno } from '@/services/turnoService';
import type { PasoVisita, VisitaAgenda } from '@/lib/visitasAgenda';
import { IconoNotaTurno, tieneNotaTurno } from './IconoNotaTurno';
import { formatFechaMini, horaDeHora, type ProfesionalLabel } from './agendaDateHelpers';
import { SWIPE_PEEK, SWIPE_REVEAL, useSwipeCancelar } from './useSwipeCancelar';

const WHATSAPP_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';

// Tarjeta de una visita: los turnos de una promo (o de varios servicios agendados
// juntos) del mismo dia. Arriba el cliente y la promo; abajo un paso por turno.
// El encabezado no abre nada (solo tiene el WhatsApp); cada paso abre su turno.
// Deslizar cancela toda la visita.
export function VisitaCard({
  visita,
  profesionalDe,
  whatsappHref,
  onCancel,
  onAbrirPaso,
  onFinalizarPaso,
}: {
  visita: VisitaAgenda;
  // Datos del profesional de cada paso (avatar y color); sin ellos cae a las iniciales del nombre.
  profesionalDe?: (profesionalId: number) => ProfesionalLabel | null | undefined;
  whatsappHref?: string;
  onCancel?: () => void;
  onAbrirPaso: (turnoId: number) => void;
  onFinalizarPaso?: (turno: Turno) => void;
}) {
  const t = useTranslations('agenda.VisitaCard');
  const { cardRef, handlers, alTocar } = useSwipeCancelar();
  const { cabecera } = visita;
  const cantidadServicios = Math.max(visita.pasos.length, visita.pasos.reduce((n, p) => n + p.servicios.length, 0));

  const contenido = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 12px 10px 16px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <NombreExpandible
              texto={cabecera.cliente ? `${cabecera.cliente.nombre} ${cabecera.cliente.apellido}` : t('clienteEliminado')}
              style={{ fontSize: 15.5, fontWeight: 600, color: colors.textStrong }}
            />
            {cabecera.origen === 'web' && reservaOnlineHabilitada() && <BadgeReservaOnline compacto />}
            {tieneNotaTurno(cabecera.notas) && <IconoNotaTurno />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {visita.promo ? (
              <>
                <span style={{
                  flexShrink: 0, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                  color: colors.success, backgroundColor: colors.successBg, borderRadius: 8, padding: '2px 6px',
                }}>
                  {t('promo')}
                </span>
                <NombreExpandible texto={visita.promo.nombre} style={{ fontSize: 13, color: colors.subtext, fontStyle: 'italic' }} />
              </>
            ) : (
              <span style={{ fontSize: 13, color: colors.subtext, fontStyle: 'italic' }}>{t('serviciosJuntos', { n: cantidadServicios })}</span>
            )}
          </div>
        </div>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('whatsapp')}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={colors.whatsapp} aria-hidden="true"><path d={WHATSAPP_PATH} /></svg>
          </a>
        )}
      </div>

      {visita.pasos.map((paso) => (
        <FilaPaso
          key={paso.turnoId}
          paso={paso}
          profesional={profesionalDe?.(paso.profesionalId)}
          alAbrir={alTocar(() => onAbrirPaso(paso.turnoId))}
          onFinalizar={paso.enCurso && paso.turno && onFinalizarPaso ? () => onFinalizarPaso(paso.turno!) : undefined}
        />
      ))}
    </>
  );

  return (
    <div style={{
      position: 'relative', borderRadius: 18, border: `1px solid ${colors.border}`, boxShadow: shadows.card,
      overflow: 'hidden', backgroundColor: colors.surface,
    }}>
      {onCancel ? (
        <>
          <div onClick={onCancel} style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end', cursor: 'pointer' }}>
            <div style={{
              width: SWIPE_REVEAL, height: '100%', backgroundColor: colors.dangerBg,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}>
              <Trash2 size={22} color={colors.danger} strokeWidth={2} aria-hidden="true" />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: colors.danger, letterSpacing: 0.5 }}>
                {t('cancelar')}
              </span>
            </div>
          </div>
          <div
            ref={cardRef}
            {...handlers}
            style={{
              position: 'relative', backgroundColor: colors.surface, paddingLeft: SWIPE_PEEK,
              transform: `translateX(${-SWIPE_PEEK}px)`, userSelect: 'none',
            }}
          >
            {contenido}
          </div>
        </>
      ) : contenido}
    </div>
  );
}

function FilaPaso({
  paso, profesional, alAbrir, onFinalizar,
}: {
  paso: PasoVisita;
  profesional?: ProfesionalLabel | null;
  alAbrir: () => void;
  onFinalizar?: () => void;
}) {
  const t = useTranslations('agenda.VisitaCard');
  const nombre = profesional?.nombre ?? paso.profesionalNombre ?? '';
  const completado = paso.estado === 'completado';
  const apagado = paso.otroDia || completado || paso.propio === false;
  const color = profesional?.color || colors.primary;
  const servicio = paso.servicios.join(' + ');

  const columnaHora = (
    <div style={{ width: 58, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontFamily: agendaFontSerif, fontSize: 17, lineHeight: 1, color: colors.textStrong }}>{horaDeHora(paso.hora)}</span>
      {paso.otroDia ? (
        <span style={{ fontSize: 9, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
          {formatFechaMini(paso.hora)}
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: colors.subtext, whiteSpace: 'nowrap', lineHeight: 1 }}>
          <Clock size={10} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0 }} />
          {formatearDuracion(paso.duracionMin)}
        </span>
      )}
    </div>
  );

  const detalle = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontFamily: agendaFontSerif, fontStyle: 'italic', fontSize: 13, color: colors.subtext, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {servicio}
        </span>
        {completado && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: colors.success }}>
            <Check size={11} strokeWidth={3} aria-hidden="true" />
            {t('listo')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 16, height: 16, borderRadius: 8, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, fontWeight: 800, backgroundColor: withAlpha(color, '26'), color,
        }}>
          {profesional?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profesional.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            inicialesProfesional(nombre, profesional?.apellido)
          )}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: colors.subtext, whiteSpace: 'nowrap' }}>{t('conProfesional', { nombre })}</span>
      </div>
    </div>
  );

  const fila: React.CSSProperties = {
    display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box',
    borderTop: `1px ${paso.otroDia ? 'dashed' : 'solid'} ${paso.otroDia ? colors.border : colors.divider}`,
    backgroundColor: paso.propio === true ? colors.surfaceSubtle : 'transparent',
  };

  // Un paso de otro dia no esta en la lista: se ve apagado, sin abrirse.
  if (!paso.turno) {
    return (
      <div style={{ ...fila, gap: 12, padding: '9px 16px', opacity: 0.5 }}>
        {columnaHora}
        <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.divider }} />
        {detalle}
      </div>
    );
  }

  return (
    <div style={fila}>
      <button
        type="button"
        onClick={alAbrir}
        aria-label={t('abrirPaso', { servicio, profesional: nombre })}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0 9px 16px',
          background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit',
          opacity: apagado ? (completado ? 0.55 : 0.5) : 1,
        }}
      >
        {columnaHora}
        <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.divider }} />
        {detalle}
        {!onFinalizar && <ChevronRight size={20} color={colors.muted} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginRight: 12 }} />}
      </button>
      {onFinalizar && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, padding: '0 12px 0 8px', flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: colors.amberFg, textTransform: 'uppercase',
            letterSpacing: 0.3, backgroundColor: colors.amberBg, borderRadius: 8, padding: '2px 7px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.amber, flexShrink: 0 }} />
            {t('enCurso')}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFinalizar(); }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{ fontSize: 11, fontWeight: 600, color: colors.primaryFg, border: 'none', borderRadius: 20, padding: '6px 14px', backgroundColor: colors.primarySolid, cursor: 'pointer' }}
          >
            {t('finalizar')}
          </button>
        </div>
      )}
    </div>
  );
}
