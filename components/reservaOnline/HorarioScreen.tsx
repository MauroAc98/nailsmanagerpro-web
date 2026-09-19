'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { diasDesde } from '@/lib/reservaOnline/diasDesde';
import { diaCorto, diaDelMes, diaLargoCorto, hoyDelSalon, mesAnio } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { duracionDeServicios, formatearDuracion } from '@/lib/reservaOnline/totales';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { IcoCalendario } from './iconos';
import { Avatar, BarraInferior, BotonPrimario, Etiqueta, Mensaje, PasoHeader } from './ui';

const DIAS_POR_TANDA = 14;
// Los horarios se agrupan por antes / despues de las 13:00.
const CORTE_TARDE = '13:00';

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Pantalla 3: profesional (avatares), tira de dias (con punto de disponibilidad
// solo si el servicio lo sabe) y horarios libres agrupados Manana/Tarde.
// `ahora` es inyectable para tests (el "hoy" de la tira sale del reloj).
export function HorarioScreen({ slug, ir, ahora = Date.now }: { slug: string; ir: Ir; ahora?: () => number }) {
  const t = useTranslations('reservaOnline');
  const locale = useLocale();
  const listo = useGuardaPaso(slug, 'horario', ir);

  const servicioIds = useReservaOnlineStore((s) => s.servicioIds);
  const profesionalId = useReservaOnlineStore((s) => s.profesionalId);
  const fechaGuardada = useReservaOnlineStore((s) => s.fecha);
  const horaGuardada = useReservaOnlineStore((s) => s.hora);
  const setProfesional = useReservaOnlineStore((s) => s.setProfesional);
  const setHorario = useReservaOnlineStore((s) => s.setHorario);

  const [hoy] = useState(() => hoyDelSalon(ahora()));
  const [fechaSel, setFechaSel] = useState<string>(() => fechaGuardada ?? hoy);
  const [tandas, setTandas] = useState(1);
  // Retencion: al entrar se suelta el hold anterior (si lo habia) ANTES de pedir
  // horarios, asi el horario propio vuelve a figurar libre.
  const [liberado, setLiberado] = useState(false);
  const [reteniendo, setReteniendo] = useState(false);
  const [tomado, setTomado] = useState(false);
  const [errorRetener, setErrorRetener] = useState(false);
  const dias = diasDesde(hoy, DIAS_POR_TANDA * tandas);

  useEffect(() => {
    if (!listo) return;
    const { hold, limpiarHold } = useReservaOnlineStore.getState();
    let vigente = true;
    const previo = hold
      ? getService()
          .liberarHold(slug, hold.reservaId)
          .catch(() => {
            // un hold que ya no existe o vencio no bloquea elegir otro horario
          })
          .then(limpiarHold)
      : Promise.resolve();
    previo.then(() => vigente && setLiberado(true));
    return () => {
      vigente = false;
    };
  }, [listo, slug]);

  const { data: salon } = useCarga(() => getService().getSalon(slug), slug);
  const { data: servicios } = useCarga(() => getService().getServices(slug), slug);
  const claveDisp = `${slug}|${fechaSel}|${servicioIds.join(',')}|${profesionalId}|${liberado}`;
  const { data: disp, error, cargando, reintentar } = useCarga(
    () =>
      liberado
        ? getService().getAvailability(slug, {
            fecha: fechaSel,
            servicioIds,
            profesionalId: profesionalId === 'any' ? undefined : profesionalId,
          })
        : new Promise<never>(() => {}), // espera a que se suelte el hold anterior
    claveDisp,
  );
  // Puntos de disponibilidad: `null` = el origen no lo sabe (adapter real) y
  // no se dibuja ninguno (sin datos inventados).
  const { data: diasConHorarios } = useCarga(
    () =>
      getService().getDiasConDisponibilidad(slug, {
        fechas: dias,
        servicioIds,
        profesionalId: profesionalId === 'any' ? undefined : profesionalId,
      }),
    `${slug}|${dias.length}|${servicioIds.join(',')}|${profesionalId}`,
  );

  if (!listo) return null;

  const sinHorarios = error?.code === 'validation' || (disp !== null && disp.slots.length === 0);
  const errorDeCarga = error && error.code !== 'validation';
  const horaElegida = fechaGuardada === fechaSel ? horaGuardada : null;
  const duracion = duracionDeServicios(servicios ?? [], servicioIds);
  const profesionalNombre =
    profesionalId === 'any' ? null : salon?.profesionales.find((p) => p.id === profesionalId)?.nombre;

  const continuar = async () => {
    if (!horaElegida) return;
    setReteniendo(true);
    setTomado(false);
    setErrorRetener(false);
    try {
      const retencion = await getService().retenerHorario(slug, {
        servicioIds,
        fecha: fechaSel,
        hora: horaElegida,
        profesionalId: profesionalId === 'any' ? undefined : profesionalId,
      });
      useReservaOnlineStore.getState().setHold({
        reservaId: retencion.reservaId,
        expiraMs: retencion.expiresAtMs,
        profesionalId: retencion.profesionalId,
      });
      ir(rutaPaso(slug, 'datos'));
    } catch (e) {
      if (e instanceof ReservaOnlineError && e.code === 'slot_taken') {
        // La lista estaba vieja: se suelta la hora elegida y se vuelven a pedir los horarios.
        useReservaOnlineStore.getState().limpiarHorario();
        setTomado(true);
        reintentar();
      } else {
        setErrorRetener(true);
      }
    } finally {
      setReteniendo(false);
    }
  };

  const manana = disp?.slots.filter((s) => s.hora < CORTE_TARDE) ?? [];
  const tarde = disp?.slots.filter((s) => s.hora >= CORTE_TARDE) ?? [];

  const grupo = (titulo: string, slots: typeof manana) =>
    slots.length > 0 && (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.strong, marginBottom: 8 }}>{titulo}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {slots.map((s) => {
            const activo = horaElegida === s.hora;
            return (
              <button
                key={s.hora}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  setTomado(false);
                  setHorario(fechaSel, s.hora);
                }}
                style={{
                  padding: '13px 0', borderRadius: 12, fontSize: 15, cursor: 'pointer',
                  fontWeight: activo ? 700 : 600,
                  background: activo ? colors.strong : colors.surface,
                  border: `1px solid ${activo ? colors.strong : colors.border}`,
                  color: activo ? colors.bg : colors.strong,
                }}
              >
                {s.hora}
              </button>
            );
          })}
        </div>
      </div>
    );

  const avatarBoton = (id: number | 'any', nombre: string, contenido?: string) => {
    const activo = profesionalId === id;
    return (
      <button
        key={id}
        type="button"
        data-profesional=""
        aria-label={nombre}
        aria-pressed={activo}
        onClick={() => setProfesional(id)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'center' }}
      >
        <Avatar nombre={nombre} size={48} anillo={activo}>
          {contenido}
        </Avatar>
        <div
          style={{
            fontSize: 12, marginTop: 5, fontWeight: activo ? 700 : 400, color: activo ? colors.strong : colors.text,
            maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {nombre.trim().split(/\s+/)[0]}
        </div>
      </button>
    );
  };

  return (
    <div>
      <PasoHeader
        titulo={t('horario.title')}
        subtitulo={duracion > 0 ? t('horario.subtitulo', { duracion: formatearDuracion(duracion) }) : undefined}
        paso={2}
        onVolver={() => ir(rutaPaso(slug, 'servicios'))}
      />

      <Etiqueta>{t('horario.profesional')}</Etiqueta>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        {avatarBoton('any', t('horario.cualquiera'), '★')}
        {salon?.profesionales.map((p) => avatarBoton(p.id, p.nombre))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '20px 0 10px' }}>
        <Etiqueta>{mesAnio(fechaSel, locale)}</Etiqueta>
        <button
          type="button"
          onClick={() => setTandas((n) => n + 1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', fontSize: 13,
            fontWeight: 600, color: colors.primaryDeep, cursor: 'pointer',
          }}
        >
          <IcoCalendario color={colors.primaryDeep} />
          {t('horario.verMasDias')}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
        {dias.map((d) => {
          const activo = d === fechaSel;
          const conHorarios = diasConHorarios?.includes(d) ?? false;
          const sinDisponibilidad = diasConHorarios != null && !conHorarios;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={activo}
              aria-label={`${diaCorto(d, locale)} ${diaDelMes(d)}`}
              onClick={() => {
                setTomado(false);
                setFechaSel(d);
              }}
              style={{
                width: 54, flexShrink: 0, padding: '10px 0 4px', borderRadius: 16, textAlign: 'center', cursor: 'pointer',
                background: activo ? colors.strong : colors.surface,
                border: `1px solid ${activo ? colors.strong : colors.border}`,
                color: activo ? colors.bg : sinDisponibilidad ? colors.muted : colors.strong,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{diaCorto(d, locale)}</div>
              <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{diaDelMes(d)}</div>
              <div style={{ height: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {conHorarios && (
                  <span
                    data-disponible=""
                    style={{ width: 5, height: 5, borderRadius: 3, background: activo ? colors.bg : colors.primary }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {cargando && <Mensaje>{t('comun.cargando')}</Mensaje>}
      {errorDeCarga && (
        <>
          <Mensaje tono="error">{t('horario.errorCarga')}</Mensaje>
          <button type="button" onClick={reintentar}>{t('comun.reintentar')}</button>
        </>
      )}
      {sinHorarios && <Mensaje>{t('horario.sinHorarios')}</Mensaje>}
      {tomado && <Mensaje tono="error">{t('horario.tomado')}</Mensaje>}
      {errorRetener && <Mensaje tono="error">{t('errores.generico')}</Mensaje>}
      {grupo(t('horario.manana'), manana)}
      {grupo(t('horario.tarde'), tarde)}

      <BarraInferior>
        {horaElegida && (
          <div style={{ textAlign: 'center', fontSize: 13, color: colors.sub, marginBottom: 10 }}>
            {t.rich(profesionalNombre ? 'horario.elegidoCon' : 'horario.elegidoCualquiera', {
              dia: capitalizar(diaLargoCorto(fechaSel, locale)),
              hora: horaElegida,
              profesional: profesionalNombre ?? '',
              b: (chunks) => <b style={{ color: colors.strong }}>{chunks}</b>,
            })}
          </div>
        )}
        <BotonPrimario disabled={!horaElegida || reteniendo} onClick={continuar}>
          {reteniendo ? t('horario.reteniendo') : t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
