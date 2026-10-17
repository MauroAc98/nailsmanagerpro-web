'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { BadgeReservaOnline } from '@/components/reservaOnline/BadgeReservaOnline';
import { formatearDuracion } from '@/lib/duracion';
import { infoEstado } from '@/lib/pro/estado';
import { horaDe, partirFechaHora } from '@/lib/pro/fechaHora';
import type { ProTurno, ProVinculo } from '@/lib/pro/tipos';
import { agendaColors as colors, agendaFontSerif, agendaShadows as shadows } from '@/theme/agendaColors';

interface Props {
  turno: ProTurno;
  // Quien atiende, para la línea "con {nombre}". Sin el dato la línea no se dibuja.
  profesional?: ProVinculo['profesional'];
  // La navegación al detalle es de quien usa la tarjeta (P9b/P12): acá no se navega.
  onAbrir?: (id: number) => void;
}

const truncar = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

// "sáb 17/10": el día sale de las partes del string en UTC, la zona del
// dispositivo no puede correrlo.
function miniFecha(fecha: string, locale: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const semana = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(anio, mes - 1, dia)))
    .replace('.', '');
  return `${semana} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

// Tarjeta de solo lectura de un turno del portal. Lee ÚNICAMENTE los campos de la
// lista blanca (ProTurno): no existe ningún camino para mostrar teléfono, precio,
// seña, pagos ni enlaces de contacto. Las notas son texto plano. Mismo lenguaje
// visual que la agenda de la titular: turno suelto, finalizado y visita con promo.
export function ProTurnoCard({ turno, profesional, onAbrir }: Props) {
  const t = useTranslations('profesionales');
  const locale = useLocale();
  const inicio = horaDe(turno.fecha_hora);
  const dia = partirFechaHora(turno.fecha_hora)?.fecha ?? null;
  const duracion =
    Number.isInteger(turno.duracion_total_minutos) && turno.duracion_total_minutos > 0
      ? formatearDuracion(turno.duracion_total_minutos)
      : null;
  const estado = infoEstado(turno.estado_visual);
  const completado = estado.clave === 'completado';
  const enCurso = estado.clave === 'en_curso';
  const nombre = [turno.cliente.nombre, turno.cliente.apellido]
    .map((parte) => (typeof parte === 'string' ? parte.trim() : ''))
    .filter((parte) => parte !== '')
    .join(' ');
  const notas = typeof turno.notas === 'string' && turno.notas.trim() !== '' ? turno.notas : null;
  const servicios = turno.servicios.map((s) => s.nombre).join(' + ');
  const conPromo = turno.promo !== null;
  const atenuado: CSSProperties = completado ? { opacity: 0.55 } : {};

  const textoNombre = (
    <span dir="auto" style={{ ...truncar, display: 'block', fontSize: 15.5, fontWeight: 600, color: colors.textStrong, unicodeBidi: 'isolate' }}>
      {nombre === '' ? t('Card.sinNombre') : nombre}
    </span>
  );

  // Reserva online: solo el ícono junto al nombre, que cede ancho (truncar) antes que el badge.
  const nombreCliente =
    turno.origen === 'web' ? (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {textoNombre}
        <BadgeReservaOnline compacto />
      </span>
    ) : (
      textoNombre
    );

  const lineaServicios = servicios !== '' && (
    <span dir="auto" style={{ ...truncar, display: 'block', fontFamily: agendaFontSerif, fontStyle: 'italic', fontSize: 13, color: colors.subtext, unicodeBidi: 'isolate' }}>
      {servicios}
    </span>
  );

  const lineaProfesional = profesional !== undefined && (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <AvatarProfesional nombre={profesional.nombre} apellido={profesional.apellido} avatarUrl={profesional.avatar_url} size={16} fontSize={7} />
      <span dir="auto" style={{ ...truncar, fontSize: 11.5, fontWeight: 700, color: colors.subtext, unicodeBidi: 'isolate' }}>
        {t('Card.conProfesional', { nombre: profesional.nombre })}
      </span>
    </span>
  );

  // Columna de la hora: serif, y debajo la mini fecha (suelto) o solo la duración (paso de promo).
  const columnaHora = (ancho: number, tamano: number, conFecha: boolean): ReactNode => (
    <span style={{ width: ancho, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, ...atenuado }}>
      <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: tamano, lineHeight: 1, color: colors.textStrong }}>
        {inicio ?? t('Card.sinHora')}
      </span>
      {conFecha && dia !== null && (
        <span style={{ fontSize: 9, fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
          {miniFecha(dia, locale)}
        </span>
      )}
      {duracion !== null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: colors.subtext, whiteSpace: 'nowrap', lineHeight: 1 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {duracion}
        </span>
      )}
    </span>
  );

  const separador = <span aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', flexShrink: 0, backgroundColor: colors.divider }} />;

  const pildora = enCurso ? (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 9, fontWeight: 700, color: colors.amberFg,
        textTransform: 'uppercase', letterSpacing: 0.3, backgroundColor: colors.amberBg, borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.amber, flexShrink: 0 }} />
      {t('Estado.en_curso')}
    </span>
  ) : completado ? (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 9, fontWeight: 700, color: colors.primaryDeep,
        letterSpacing: 0.6, textTransform: 'uppercase', backgroundColor: colors.primarySoft, borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {t('Estado.completado')}
    </span>
  ) : null;

  // Finalizado: solo la píldora a la derecha, como FinalizadoCard de la agenda de la titular
  // (el chevron le quitaba ancho al nombre y lo cortaba con "…").
  const chevron = completado ? null : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );

  const bloqueNotas = notas !== null && (
    <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
      <span
        role="img"
        aria-label={t('Card.nota')}
        title={t('Card.nota')}
        style={{ flexShrink: 0, display: 'inline-flex', padding: 3, borderRadius: 6, color: colors.amberFg, background: colors.amberBg }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
          <path d="M5.5 6.5h5M5.5 8.5h3" />
        </svg>
      </span>
      <span
        data-nota="true"
        dir="auto"
        style={{
          flex: 1, minWidth: 0, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', unicodeBidi: 'isolate', fontSize: 13, color: colors.subtext,
        }}
      >
        {notas}
      </span>
    </span>
  );

  const contenido = conPromo ? (
    <>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, padding: '14px 16px 10px' }}>
        <span style={{ ...atenuado, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          {nombreCliente}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span
              style={{
                flexShrink: 0, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: colors.success,
                backgroundColor: colors.successBg, borderRadius: 8, padding: '2px 6px',
              }}
            >
              {t('Card.promo')}
            </span>
            <span dir="auto" style={{ ...truncar, fontSize: 13, color: colors.subtext, fontStyle: 'italic', unicodeBidi: 'isolate' }}>
              {turno.promo?.nombre}
            </span>
          </span>
        </span>
      </span>
      <span
        style={{
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: '9px 12px 9px 16px',
          borderTop: `1px solid ${colors.divider}`, backgroundColor: colors.surfaceSubtle,
        }}
      >
        {columnaHora(58, 17, false)}
        {separador}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, ...atenuado }}>
          {lineaServicios}
          {lineaProfesional}
        </span>
        {pildora}
        {chevron}
      </span>
      {bloqueNotas && <span style={{ display: 'flex', padding: '8px 16px 10px', borderTop: `1px solid ${colors.divider}` }}>{bloqueNotas}</span>}
    </>
  ) : (
    <span style={{ display: 'flex', alignItems: 'stretch', minHeight: 88, paddingLeft: 16 }}>
      {columnaHora(66, 19, true)}
      {separador}
      <span style={{ flex: 1, minWidth: 0, padding: '10px 0 10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, ...atenuado }}>
          {nombreCliente}
          {lineaServicios}
          {lineaProfesional}
        </span>
        {bloqueNotas && <span style={{ display: 'flex', paddingTop: 4 }}>{bloqueNotas}</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '0 16px 0 10px' }}>
        {pildora}
        {chevron}
      </span>
    </span>
  );

  const base: CSSProperties = {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 44,
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    textAlign: 'left',
    borderRadius: 18,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
    backgroundColor: completado ? colors.surfaceSubtle : colors.surface,
    color: colors.text,
    boxShadow: shadows.card,
  };

  if (onAbrir === undefined) return <div style={base}>{contenido}</div>;
  return (
    <button type="button" onClick={() => onAbrir(turno.id)} style={{ ...base, cursor: 'pointer', font: 'inherit' }}>
      {contenido}
    </button>
  );
}
