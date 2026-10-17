'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Spinner } from '@/components/Spinner';
import { useProTurno } from '@/hooks/pro/useProTurno';
import { useRutaPro } from '@/hooks/useRutaPro';
import { infoEstado } from '@/lib/pro/estado';
import { diaDe, horaDe, horaFin } from '@/lib/pro/fechaHora';
import { useProAgendaStore } from '@/store/useProAgendaStore';
import { useProAuthStore } from '@/store/useProAuthStore';
import { agendaColors, agendaFontSerif } from '@/theme/agendaColors';
import { MensajeErrorPro } from './MensajeErrorPro';
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

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <dt style={{ fontSize: 13, fontWeight: 600, color: agendaColors.sub }}>{etiqueta}</dt>
      <dd style={{ margin: 0, fontSize: 16, color: agendaColors.strong, ...textoLargo }}>{children}</dd>
    </div>
  );
}

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
      style={{ ...boton, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', alignSelf: 'flex-start' }}
    >
      {t('Detalle.volver')}
    </Link>
  );

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
    const dia = diaDe(data.fecha_hora);
    const inicio = horaDe(data.fecha_hora);
    const fin = inicio === null ? null : horaFin(inicio, data.duracion_total_minutos);
    const estado = infoEstado(data.estado_visual);
    const nombre = [data.cliente.nombre, data.cliente.apellido]
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p !== '')
      .join(' ');
    const notas = typeof data.notas === 'string' && data.notas.trim() !== '' ? data.notas : null;

    cuerpo = (
      <>
        {error !== null && (
          <p role="status" style={{ margin: 0, fontSize: 14, color: agendaColors.sub }}>
            {t('Detalle.errorRefresco')}
          </p>
        )}
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Dato etiqueta={t('Detalle.fecha')}>{dia === null ? t('Card.sinHora') : etiquetaDeFecha(dia, locale)}</Dato>
          <Dato etiqueta={t('Detalle.hora')}>
            {inicio === null ? t('Card.sinHora') : fin === null ? inicio : `${inicio} – ${fin.hora}`}
            {fin?.diaSiguiente === true && (
              <span style={{ marginLeft: 6, fontSize: 12, color: agendaColors.sub }}>{t('Card.diaSiguiente')}</span>
            )}
          </Dato>
          <Dato etiqueta={t('Detalle.estado')}>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: estado.fg, background: estado.bg }}>
              {t(`Estado.${estado.clave}`)}
            </span>
          </Dato>
          <Dato etiqueta={t('Detalle.cliente')}>
            <span dir="auto">{nombre === '' ? t('Card.sinNombre') : nombre}</span>
          </Dato>
          {data.servicios.length > 0 && (
            <Dato etiqueta={t('Detalle.servicios')}>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.servicios.map((s) => (
                  <li key={s.id} dir="auto" style={textoLargo}>
                    {s.nombre}
                  </li>
                ))}
              </ul>
            </Dato>
          )}
          {data.promo !== null && (
            <Dato etiqueta={t('Detalle.promo')}>
              <span dir="auto">{data.promo.nombre}</span>
            </Dato>
          )}
          <Dato etiqueta={t('Detalle.notas')}>
            {notas === null ? (
              <span style={{ color: agendaColors.sub }}>{t('Detalle.sinNotas')}</span>
            ) : (
              <span data-testid="detalle-notas" dir="auto" style={{ display: 'block', whiteSpace: 'pre-wrap', ...textoLargo }}>
                {notas}
              </span>
            )}
          </Dato>
        </dl>
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
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {volver}
          <h1
            ref={titulo}
            tabIndex={-1}
            style={{ margin: 0, fontSize: 22, fontFamily: agendaFontSerif, color: agendaColors.strong, outline: 'none' }}
          >
            {t('Detalle.titulo')}
          </h1>
          {cuerpo}
        </div>
      </main>
      <ProNav />
    </>
  );
}
