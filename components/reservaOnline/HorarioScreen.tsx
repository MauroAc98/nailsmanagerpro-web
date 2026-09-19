'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { diasDesde } from '@/lib/reservaOnline/diasDesde';
import { diaCorto, diaDelMes, diaLargoCorto, hoyDelSalon, mesAnio } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { BarraInferior, BotonPrimario, Etiqueta, Mensaje, PasoHeader } from './ui';

const DIAS_POR_TANDA = 14;

// Pantalla 3: profesional (chips), tira de dias y grilla de horarios libres.
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

  const { data: salon } = useCarga(() => getService().getSalon(slug), slug);
  const claveDisp = `${slug}|${fechaSel}|${servicioIds.join(',')}|${profesionalId}`;
  const { data: disp, error, cargando, reintentar } = useCarga(
    () =>
      getService().getAvailability(slug, {
        fecha: fechaSel,
        servicioIds,
        profesionalId: profesionalId === 'any' ? undefined : profesionalId,
      }),
    claveDisp,
  );

  if (!listo) return null;

  const dias = diasDesde(hoy, DIAS_POR_TANDA * tandas);
  const sinHorarios = error?.code === 'validation' || (disp !== null && disp.slots.length === 0);
  const errorDeCarga = error && error.code !== 'validation';
  const horaElegida = fechaGuardada === fechaSel ? horaGuardada : null;

  const chip = (activo: boolean) => ({
    padding: '9px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: activo ? colors.primarySolid : colors.surface,
    border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
    color: activo ? colors.primaryFg : colors.text,
  });

  return (
    <div>
      <PasoHeader titulo={t('horario.title')} paso={2} onVolver={() => ir(rutaPaso(slug, 'servicios'))} />

      <Etiqueta>{t('horario.conQuien')}</Etiqueta>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          type="button"
          aria-pressed={profesionalId === 'any'}
          style={chip(profesionalId === 'any')}
          onClick={() => setProfesional('any')}
        >
          {t('horario.cualquiera')}
        </button>
        {salon?.profesionales.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={profesionalId === p.id}
            style={chip(profesionalId === p.id)}
            onClick={() => setProfesional(p.id)}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Etiqueta>{mesAnio(fechaSel, locale)}</Etiqueta>
        <button
          type="button"
          onClick={() => setTandas((n) => n + 1)}
          style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: colors.primaryDeep, cursor: 'pointer' }}
        >
          {t('horario.verMasDias')}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
        {dias.map((d) => {
          const activo = d === fechaSel;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={activo}
              aria-label={`${diaCorto(d, locale)} ${diaDelMes(d)}`}
              onClick={() => setFechaSel(d)}
              style={{
                width: 52, flexShrink: 0, padding: '10px 0', borderRadius: 14, textAlign: 'center', cursor: 'pointer',
                background: activo ? colors.primarySolid : colors.surface,
                border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
                color: activo ? colors.primaryFg : colors.strong,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{diaCorto(d, locale)}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{diaDelMes(d)}</div>
            </button>
          );
        })}
      </div>

      <Etiqueta>{t('horario.horarios', { dia: diaLargoCorto(fechaSel, locale) })}</Etiqueta>
      {cargando && <Mensaje>{t('comun.cargando')}</Mensaje>}
      {errorDeCarga && (
        <>
          <Mensaje tono="error">{t('horario.errorCarga')}</Mensaje>
          <button type="button" onClick={reintentar}>{t('comun.reintentar')}</button>
        </>
      )}
      {sinHorarios && <Mensaje>{t('horario.sinHorarios')}</Mensaje>}
      {disp && disp.slots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {disp.slots.map((s) => {
            const activo = horaElegida === s.hora;
            return (
              <button
                key={s.hora}
                type="button"
                aria-pressed={activo}
                onClick={() => setHorario(fechaSel, s.hora)}
                style={{
                  padding: '12px 0', borderRadius: 12, fontSize: 15, cursor: 'pointer',
                  fontWeight: activo ? 700 : 600,
                  background: activo ? colors.primarySolid : colors.surface,
                  border: `1px solid ${activo ? colors.primarySolid : colors.border}`,
                  color: activo ? colors.primaryFg : colors.strong,
                }}
              >
                {s.hora}
              </button>
            );
          })}
        </div>
      )}
      {disp && (
        <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 14 }}>
          {t('horario.duracion', { minutos: disp.duracionTotalMinutos })}
        </div>
      )}

      <BarraInferior>
        <BotonPrimario disabled={!horaElegida} onClick={() => ir(rutaPaso(slug, 'datos'))}>
          {t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
