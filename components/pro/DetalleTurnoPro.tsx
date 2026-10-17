'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { Spinner } from '@/components/Spinner';
import { useProTurno } from '@/hooks/pro/useProTurno';
import { useRutaPro } from '@/hooks/useRutaPro';
import { formatearDuracion } from '@/lib/duracion';
import { infoEstado } from '@/lib/pro/estado';
import { diaDe, horaDe, horaFin } from '@/lib/pro/fechaHora';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif, agendaShadows } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';
import { NotasDelTurnoPro } from './NotasDelTurnoPro';
import { ProHeader } from './ProHeader';
import { PRO_NAV_ALTURA_AGENDA, ProNav } from './ProNav';

// Solo enteros positivos escritos en decimal simple: "1e1", "0x5" o "5/../me"
// no son un id. Cualquier otra cosa se trata como turno inexistente, sin pedir nada.
function idDeParam(param: unknown): number {
  if (typeof param !== 'string' || !/^[1-9]\d*$/.test(param)) return 0;
  const n = Number(param);
  return Number.isSafeInteger(n) ? n : 0;
}

// "sábado, 17 de octubre de 2026": se formatea en UTC con las partes del string,
// la zona del dispositivo no puede correr el día.
function etiquetaDeFecha(dia: string, locale: string): string {
  const [anio, mes, d] = dia.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, d)));
}

const boton = {
  minHeight: 44,
  padding: '0 16px',
  border: `1px solid ${agendaColors.fieldBorder}`,
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  backgroundColor: agendaColors.surface,
  color: agendaColors.strong,
} as const;

const textoLargo = { minWidth: 0, overflowWrap: 'anywhere', unicodeBidi: 'isolate' } as const;

// Detalle de solo lectura de un turno (/turnos/[id]). El id llega por la URL y se
// valida antes de cualquier pedido. Muestra solo los campos de ProTurno; las
// notas van completas, como texto plano. La fecha elegida en la agenda vive en
// su store, así que volver a /agenda conserva el día.
export function DetalleTurnoPro() {
  const t = useTranslations('profesionales');
  const locale = useLocale();
  const ruta = useRutaPro();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const id = idDeParam(params?.id);
  const fecha = useProAgendaStore((s) => s.fecha);
  const vinculoId = useProAuthStore((s) => s.vinculoActivoId);
  const profesional = useProAuthStore((s) => s.vinculos.find((v) => v.id === s.vinculoActivoId)?.profesional);
  const [vinculoInicial] = useState(vinculoId);
  const titulo = useRef<HTMLHeadingElement>(null);
  const { data, error, reintentar } = useProTurno(id, fecha);

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  // Cambiar de negocio con el detalle abierto: ese turno ya no pertenece al
  // negocio activo, se vuelve a la agenda.
  const cambioNegocio = vinculoId !== vinculoInicial;
  useEffect(() => {
    if (cambioNegocio) router.replace(ruta('/agenda'));
  }, [cambioNegocio]); // eslint-disable-line react-hooks/exhaustive-deps

  const volver = (
    <Link
      href={ruta('/agenda')}
      aria-label={t('Detalle.volver')}
      style={{
        width: 40, height: 40, borderRadius: 20, boxSizing: 'border-box', flexShrink: 0, alignSelf: 'flex-start',
        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
        border: `1px solid ${agendaColors.border}`, backgroundColor: agendaColors.surface, color: agendaColors.strong,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
    </Link>
  );

  // Lo que se ve arriba (etiqueta con la fecha, nombre y píldora) solo existe con
  // un turno a la vista; sin él, el título es el genérico del detalle.
  const turno = cambioNegocio || id === 0 || error?.kind === 'notFound' ? null : data;
  const dia = turno === null ? null : diaDe(turno.fecha_hora);
  const nombre =
    turno === null
      ? ''
      : [turno.cliente.nombre, turno.cliente.apellido]
          .map((p) => (typeof p === 'string' ? p.trim() : ''))
          .filter((p) => p !== '')
          .join(' ');
  const enCurso = turno !== null && infoEstado(turno.estado_visual).clave === 'en_curso';

  let cuerpo: ReactNode;
  if (cambioNegocio) {
    cuerpo = null;
  } else if (id === 0 || error?.kind === 'notFound') {
    cuerpo = <p style={{ margin: 0, fontSize: 15, color: agendaColors.sub }}>{t('Detalle.noEncontrado')}</p>;
  } else if (data === null && error !== null) {
    cuerpo = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <MensajeErrorPro error={error} id="detalle-error" />
        <button type="button" onClick={reintentar} aria-describedby="detalle-error" style={boton}>
          {t('Agenda.reintentar')}
        </button>
      </div>
    );
  } else if (data === null) {
    cuerpo = (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spinner label={t('Detalle.cargando')} />
      </div>
    );
  } else {
    const inicio = horaDe(data.fecha_hora);
    const fin = inicio === null ? null : horaFin(inicio, data.duracion_total_minutos);
    const notas = typeof data.notas === 'string' && data.notas.trim() !== '' ? data.notas : null;
    const duracion =
      Number.isInteger(data.duracion_total_minutos) && data.duracion_total_minutos > 0 ? formatearDuracion(data.duracion_total_minutos) : null;
    const sinHora = t('Card.sinHora');
    const fila = { borderTop: `1px solid ${agendaColors.divider}` } as const;

    cuerpo = (
      <>
        {error !== null && (
          <p role="status" style={{ margin: '0 0 16px', fontSize: 14, color: agendaColors.sub }}>
            {t('Detalle.errorRefresco')}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              borderRadius: 18, border: `1px solid ${agendaColors.border}`, backgroundColor: agendaColors.surface,
              boxShadow: agendaShadows.card, overflow: 'hidden',
            }}
          >
            {data.promo !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', backgroundColor: agendaColors.successBg }}>
                <span
                  style={{
                    flexShrink: 0, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                    color: agendaColors.success, backgroundColor: agendaColors.surface, borderRadius: 8, padding: '2px 6px',
                  }}
                >
                  {t('Card.promo')}
                </span>
                <span dir="auto" style={{ ...textoLargo, fontSize: 14, fontStyle: 'italic', color: agendaColors.text }}>
                  {data.promo.nombre}
                </span>
              </div>
            )}
            <div style={{ ...(data.promo !== null ? fila : {}), display: 'flex', alignItems: 'center', gap: 16, padding: '16px 16px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: agendaFontSerif, fontSize: 34, lineHeight: 1, color: agendaColors.strong }}>{inicio ?? sinHora}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: agendaColors.subtext }}>
                  {t('Detalle.hastaLas', { hora: fin === null ? sinHora : fin.hora })}
                </span>
                {fin?.diaSiguiente === true && <span style={{ fontSize: 12, color: agendaColors.sub }}>{t('Card.diaSiguiente')}</span>}
              </div>
              {duracion !== null && (
                <>
                  <span aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', flexShrink: 0, backgroundColor: agendaColors.divider }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: agendaColors.subtext }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {duracion}
                  </span>
                </>
              )}
            </div>
            {data.servicios.length > 0 && (
              <div style={{ ...fila, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.servicios.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0, backgroundColor: agendaColors.primary }} />
                    <span dir="auto" style={{ ...textoLargo, fontFamily: agendaFontSerif, fontStyle: 'italic', fontSize: 16, color: agendaColors.strong }}>
                      {s.nombre}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {profesional !== undefined && (
              <div style={{ ...fila, backgroundColor: agendaColors.surfaceSubtle, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AvatarProfesional nombre={profesional.nombre} apellido={profesional.apellido} avatarUrl={profesional.avatar_url} size={20} fontSize={8} />
                <span dir="auto" style={{ ...textoLargo, fontSize: 12, fontWeight: 700, color: agendaColors.subtext }}>
                  {t('Card.conProfesional', { nombre: profesional.nombre })}
                </span>
              </div>
            )}
          </div>
          {notas !== null && <NotasDelTurnoPro notas={notas} />}
        </div>
      </>
    );
  }

  return (
    <>
      <main
        style={{
          boxSizing: 'border-box',
          minHeight: '100dvh',
          backgroundColor: agendaColors.bg,
          paddingBottom: `calc(${PRO_NAV_ALTURA_AGENDA}px + env(safe-area-inset-bottom))`,
        }}
      >
        <ProHeader />
        <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {volver}
          <div style={{ padding: '12px 0 18px' }}>
            {turno !== null && (
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: agendaColors.primaryDeep, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {t('Detalle.etiqueta', { fecha: dia === null ? t('Card.sinHora') : etiquetaDeFecha(dia, locale) })}
              </p>
            )}
            <h1
              ref={titulo}
              tabIndex={-1}
              dir="auto"
              style={{
                margin: 0, fontSize: 28, fontWeight: 400, lineHeight: 1.15, fontFamily: agendaFontSerif, color: agendaColors.strong,
                outline: 'none', overflowWrap: 'anywhere',
              }}
            >
              {turno === null ? t('Detalle.titulo') : nombre === '' ? t('Card.sinNombre') : nombre}
            </h1>
            {enCurso && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: agendaColors.amberFg,
                    textTransform: 'uppercase', letterSpacing: 0.3, backgroundColor: agendaColors.amberBg, borderRadius: 8, padding: '2px 7px',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: agendaColors.amber }} />
                  {t('Estado.en_curso')}
                </span>
              </div>
            )}
          </div>
          {cuerpo}
        </div>
      </main>
      <ProNav />
    </>
  );
}
