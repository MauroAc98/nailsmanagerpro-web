'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { BottomSheet, type BottomSheetHandle } from '@/components/BottomSheet';
import { DrumPicker } from '@/components/DrumPicker';
import SelectorProfesional from '@/components/SelectorProfesional';
import { CalendarioMensual } from '@/components/agenda/CalendarioMensual';
import { WeekStrip } from '@/components/agenda/WeekStrip';
import { parseFechaLocal } from '@/components/agenda/agendaDateHelpers';
import { getService } from '@/lib/reservaOnline';
import { aMinutos, hhmm } from '@/lib/reservaOnline/adapters/mock';
import { sumarDias } from '@/lib/reservaOnline/diasDesde';
import { diaLargoCorto, hoyDelSalon } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { duracionDeServicios, formatearDuracion } from '@/lib/reservaOnline/totales';
import {
  diasReservables,
  primerDiaReservable,
  semanaDeFecha,
  ultimoDiaReservable,
} from '@/lib/reservaOnline/ventana';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { colors as baseColors } from '@/theme/colors';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { NoDisponibleAun } from './NoDisponibleAun';
import { BarraInferior, BotonPrimario, Etiqueta, Hueso, Mensaje, PasoHeader } from './ui';

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Forma de la tarjeta de horarios (la unica parte que depende de esta carga:
// el selector de profesional y la tira de semana ya se ven con datos reales
// o directamente no se muestran, asi que no hace falta duplicarlos aca).
function HorarioSkeleton() {
  return (
    <div data-testid="horario-skeleton" style={{ marginBottom: 14 }}>
      <Hueso w={90} h={11} style={{ marginBottom: 8 }} />
      <div style={{ padding: 16, borderRadius: 24, border: `1px solid ${colors.border}` }}>
        <Hueso w="70%" h={13} style={{ margin: '0 auto 14px' }} />
        <Hueso w="100%" h={132} r={12} />
        <Hueso w="55%" h={13} style={{ margin: '10px auto 0' }} />
      </div>
    </div>
  );
}

// Pantalla 3: profesional (selector compartido con la agenda), tira de semana con flechas y calendario
// (la misma de la agenda de la profesional) y UNA rueda con los inicios libres
// del dia: como los items son exactamente los horarios libres que devuelve la
// lectura de disponibilidad, no se puede armar una combinacion solapada.
// `ahora` es inyectable para tests (el "hoy" sale del reloj).
export function HorarioScreen({ slug, ir, ahora = Date.now }: { slug: string; ir: Ir; ahora?: () => number }) {
  const t = useTranslations('reservaOnline');
  const tFecha = useTranslations('agenda.ElegirFechaSheet');
  const locale = useLocale();
  const listo = useGuardaPaso(slug, 'horario', ir);

  const servicioIds = useReservaOnlineStore((s) => s.servicioIds);
  const profesionalId = useReservaOnlineStore((s) => s.profesionalId);
  const fechaGuardada = useReservaOnlineStore((s) => s.fecha);
  const horaGuardada = useReservaOnlineStore((s) => s.hora);
  const setProfesional = useReservaOnlineStore((s) => s.setProfesional);
  const setHorario = useReservaOnlineStore((s) => s.setHorario);

  const [ahoraMs] = useState(() => ahora());
  const hoy = hoyDelSalon(ahoraMs);
  const [fechaSel, setFechaSel] = useState<string>(() => fechaGuardada ?? hoy);
  // Retencion: al entrar se suelta el hold anterior (si lo habia) ANTES de pedir
  // horarios, asi el horario propio vuelve a figurar libre.
  const [liberado, setLiberado] = useState(false);
  const [reteniendo, setReteniendo] = useState(false);
  const [tomado, setTomado] = useState(false);
  const [errorRetener, setErrorRetener] = useState(false);
  // Kill switch del backend apagado (RESERVAS_CREACION_HABILITADA=false): a
  // pantalla completa, nunca se confunde con slot_taken/hold_expired (esos
  // dejan seguir reservando, esto no).
  const [noDisponible, setNoDisponible] = useState(false);
  const [avisoRetener, setAvisoRetener] = useState<'rate_limited' | 'challenge_failed' | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [sinLugarProximos, setSinLugarProximos] = useState(false);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [mesVista, setMesVista] = useState<Date>(() => parseFechaLocal(fechaGuardada ?? hoy));
  const calendarioRef = useRef<BottomSheetHandle>(null);

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
  const { data: terminos } = useCarga(() => getService().getTerms(slug), slug);

  // Ventana reservable: desde el dia de "ahora + anticipacion" hasta hoy + 30.
  const primerDia = primerDiaReservable(ahoraMs, terminos?.anticipacionMinutos ?? 0);
  const ultimoDia = ultimoDiaReservable(hoy);
  const fecha = fechaSel < primerDia ? primerDia : fechaSel > ultimoDia ? ultimoDia : fechaSel;
  const profesionalQuery = profesionalId === 'any' ? undefined : profesionalId;

  const claveDisp = `${slug}|${fecha}|${servicioIds.join(',')}|${profesionalId}|${liberado}`;
  const { data: disp, error, cargando, reintentar } = useCarga(
    () =>
      liberado
        ? getService().getAvailability(slug, { fecha, servicioIds, profesionalId: profesionalQuery })
        : new Promise<never>(() => {}), // espera a que se suelte el hold anterior
    claveDisp,
  );
  // Puntos de disponibilidad: `null` = el origen no lo sabe (adapter real) y
  // no se dibuja ninguno (sin datos inventados). Se pide toda la ventana de una
  // vez para la tira y para el calendario mensual.
  const { data: diasConHorarios } = useCarga(
    () =>
      liberado
        ? getService().getDiasConDisponibilidad(slug, {
            fechas: diasReservables(primerDia, ultimoDia),
            servicioIds,
            profesionalId: profesionalQuery,
          })
        : new Promise<never>(() => {}),
    `${slug}|${primerDia}|${servicioIds.join(',')}|${profesionalId}|${liberado}`,
  );

  const horas = useMemo(() => disp?.slots.map((s) => s.hora) ?? [], [disp]);

  if (!listo) return null;
  if (noDisponible) return <NoDisponibleAun />;

  const sinHorarios = error?.code === 'validation' || (disp !== null && disp.slots.length === 0);
  const errorDeCarga = error && error.code !== 'validation';
  // La rueda siempre apunta a una hora libre: la elegida (si sigue libre) o la primera.
  const horaEnStore = fechaGuardada === fecha ? horaGuardada : null;
  const horaRueda = horaEnStore && horas.includes(horaEnStore) ? horaEnStore : (horas[0] ?? null);
  const duracion = duracionDeServicios(servicios ?? [], servicioIds);
  const duracionTurno = disp?.duracionTotalMinutos ?? duracion;
  const profesionalNombre =
    profesionalId === 'any' ? null : salon?.profesionales.find((p) => p.id === profesionalId)?.nombre;

  const noReservable = (f: string): boolean => f < primerDia || f > ultimoDia;
  const semana = semanaDeFecha(fecha);

  // Cambiar de dia suelta la hora elegida (y su hold, si lo hubiera) y limpia avisos.
  const elegirDia = (f: string) => {
    if (noReservable(f)) return;
    setTomado(false);
    setSinLugarProximos(false);
    useReservaOnlineStore.getState().limpiarHorario();
    setFechaSel(f);
  };

  // Flechas de la tira: mismo dia de la semana en la semana anterior/siguiente,
  // acotado a la ventana reservable.
  const cambiarSemana = (delta: number) => {
    const destino = sumarDias(fecha, delta * 7);
    elegirDia(destino < primerDia ? primerDia : destino > ultimoDia ? ultimoDia : destino);
  };

  const abrirCalendario = () => {
    setMesVista(parseFechaLocal(fecha));
    setCalendarioAbierto(true);
    calendarioRef.current?.snapToIndex(0);
  };
  const cerrarCalendario = () => {
    setCalendarioAbierto(false);
    calendarioRef.current?.close();
  };

  // Una sola lectura de dias con lugar (desde el dia siguiente hasta el fin de la
  // ventana): se salta al primero. Solo si la lectura no sabe (null) se cae a
  // buscar dia por dia, acotado a la ventana.
  const irAlProximoDia = async () => {
    setBuscando(true);
    setSinLugarProximos(false);
    setErrorRetener(false);
    try {
      const desdeManana = sumarDias(fecha, 1);
      const conLugar = await getService().getDiasConDisponibilidad(slug, {
        fechas: diasReservables(desdeManana, ultimoDia),
        servicioIds,
        profesionalId: profesionalQuery,
      });
      if (conLugar !== null) {
        const proximo = [...conLugar].sort().find((f) => f > fecha && !noReservable(f));
        if (proximo) elegirDia(proximo);
        else setSinLugarProximos(true);
        return;
      }
      for (let f = desdeManana; f <= ultimoDia; f = sumarDias(f, 1)) {
        try {
          const dia = await getService().getAvailability(slug, { fecha: f, servicioIds, profesionalId: profesionalQuery });
          if (dia.slots.length > 0) {
            elegirDia(f);
            return;
          }
        } catch (e) {
          // fecha sin disponibilidad (validation): se sigue con el proximo dia
          if (!(e instanceof ReservaOnlineError && e.code === 'validation')) throw e;
        }
      }
      setSinLugarProximos(true);
    } catch {
      setErrorRetener(true);
    } finally {
      setBuscando(false);
    }
  };

  const continuar = async () => {
    if (!horaRueda) return;
    setReteniendo(true);
    setTomado(false);
    setErrorRetener(false);
    setAvisoRetener(null);
    try {
      const retencion = await getService().retenerHorario(slug, {
        servicioIds,
        fecha,
        hora: horaRueda,
        profesionalId: profesionalQuery,
      });
      setHorario(fecha, horaRueda);
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
      } else if (e instanceof ReservaOnlineError && e.code === 'creation_disabled') {
        setNoDisponible(true);
      } else if (e instanceof ReservaOnlineError && (e.code === 'rate_limited' || e.code === 'challenge_failed')) {
        setAvisoRetener(e.code);
      } else {
        setErrorRetener(true);
      }
    } finally {
      setReteniendo(false);
    }
  };

  const botonSecundario = {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    color: colors.primaryDeep, padding: '10px 0',
  } as const;

  return (
    <div>
      <PasoHeader
        titulo={t('horario.title')}
        subtitulo={duracion > 0 ? t('horario.subtitulo', { duracion: formatearDuracion(duracion) }) : undefined}
        paso={2}
        onVolver={() => ir(rutaPaso(slug, 'servicios'))}
      />

      {/* Mismo selector de la agenda propia (mismos tokens que agenda/historia);
          solo con 2+ profesionales. "Cualquiera" = sin profesional puntual. */}
      {salon && salon.profesionales.length > 1 && (
        <SelectorProfesional
          label={t('horario.profesional')}
          labelStyle={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' }}
          todasLabel={t('horario.cualquiera')}
          profesionales={salon.profesionales}
          selectedId={profesionalId === 'any' ? null : profesionalId}
          onSelect={(id) => setProfesional(id ?? 'any')}
          selectedFg={colors.primaryFg}
          unselectedBorderColor={colors.border}
          pillFontWeight={600}
        />
      )}

      {/* La tira de la agenda propia; su padding lateral propio se compensa. */}
      <div style={{ margin: '14px -20px 0' }}>
        <WeekStrip
          dates={semana.map(parseFechaLocal)}
          fechaSeleccionada={fecha}
          turnosMes={[]}
          onDayClick={elegirDia}
          onAbrirCalendario={abrirCalendario}
          onSemanaAnterior={() => cambiarSemana(-1)}
          onSemanaSiguiente={() => cambiarSemana(1)}
          diaDeshabilitado={noReservable}
          diasConPunto={diasConHorarios ?? undefined}
          semanaAnteriorDeshabilitada={semana[0] <= primerDia}
          semanaSiguienteDeshabilitada={semana[6] >= ultimoDia}
        />
      </div>

      {cargando && <HorarioSkeleton />}
      {errorDeCarga && (
        <>
          <Mensaje tono="error">{t('horario.errorCarga')}</Mensaje>
          <button type="button" onClick={reintentar}>{t('comun.reintentar')}</button>
        </>
      )}
      {sinHorarios && !cargando && (
        <div style={{ marginBottom: 14 }}>
          <Mensaje>{t('horario.sinHorarios')}</Mensaje>
          <BotonPrimario disabled={buscando} onClick={irAlProximoDia}>
            {buscando ? t('horario.buscando') : t('horario.irProximoDia')}
          </BotonPrimario>
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <button type="button" onClick={abrirCalendario} style={botonSecundario}>
              {t('horario.elegirOtroDia')}
            </button>
          </div>
        </div>
      )}
      {sinLugarProximos && <Mensaje>{t('horario.sinLugarProximos')}</Mensaje>}
      {tomado && <Mensaje tono="error">{t('horario.tomado')}</Mensaje>}
      {avisoRetener === 'rate_limited' && <Mensaje tono="error">{t('errores.limiteIntentos')}</Mensaje>}
      {avisoRetener === 'challenge_failed' && <Mensaje tono="error">{t('errores.desafioFallido')}</Mensaje>}
      {errorRetener && <Mensaje tono="error">{t('errores.generico')}</Mensaje>}

      {horaRueda && horas.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Etiqueta>{t('horario.labelHora')}</Etiqueta>
          <div
            style={{
              padding: 16, borderRadius: 24, border: `1px solid ${colors.border}`,
              backgroundColor: baseColors.surface,
            }}
          >
            <p style={{ textAlign: 'center', fontSize: 13, color: colors.sub, margin: '0 0 8px' }}>
              {t('horario.resumenLibres', { n: horas.length, desde: horas[0], hasta: horas[horas.length - 1] })}
            </p>
            {/* key: si cambia la lista (otro dia/profesional) la rueda se rearma en la hora elegida */}
            <DrumPicker
              key={horas.join(',')}
              columns={[{ name: 'hora', items: horas }]}
              value={{ hora: horaRueda }}
              onChange={(v) => {
                setTomado(false);
                setHorario(fecha, v.hora);
              }}
            />
            <p style={{ textAlign: 'center', fontSize: 13, color: colors.sub, margin: '8px 0 0' }}>
              {t.rich('horario.ocupaRango', {
                inicio: horaRueda,
                fin: hhmm(aMinutos(horaRueda) + duracionTurno),
                b: (chunks) => <b style={{ color: colors.strong }}>{chunks}</b>,
              })}
            </p>
          </div>
        </div>
      )}

      <BarraInferior>
        {horaRueda && (
          <div style={{ textAlign: 'center', fontSize: 13, color: colors.sub, marginBottom: 10 }}>
            {t.rich(profesionalNombre ? 'horario.elegidoCon' : 'horario.elegidoCualquiera', {
              dia: capitalizar(diaLargoCorto(fecha, locale)),
              hora: horaRueda,
              profesional: profesionalNombre ?? '',
              b: (chunks) => <b style={{ color: colors.strong }}>{chunks}</b>,
            })}
          </div>
        )}
        <BotonPrimario disabled={!horaRueda || reteniendo} onClick={continuar}>
          {reteniendo ? t('horario.reteniendo') : t('comun.continuar')}
        </BotonPrimario>
      </BarraInferior>

      {/* Mismo calendario mensual de la agenda propia, en un sheet: tocar un dia
          es la confirmacion; los dias fuera de la ventana no se pueden tocar. */}
      <BottomSheet
        ref={calendarioRef}
        snapPoints={[0.65]}
        initialIndex={-1}
        enablePanDownToClose
        onChange={(i) => setCalendarioAbierto(i >= 0)}
        handleColor={colors.border}
        backgroundColor={colors.surface}
      >
        <div data-calendario-abierto={calendarioAbierto ? 'true' : 'false'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 12px' }}>
            <span style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, color: colors.textStrong }}>
              {tFecha('title')}
            </span>
            <button
              type="button"
              onClick={cerrarCalendario}
              aria-label={tFecha('close')}
              style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} color={colors.text} strokeWidth={2} />
            </button>
          </div>
          <CalendarioMensual
            viewDate={mesVista}
            onMonthChange={setMesVista}
            fechaSeleccionada={fecha}
            turnosMes={[]}
            onDayClick={(f) => {
              elegirDia(f);
              cerrarCalendario();
            }}
            diaDeshabilitado={noReservable}
            diasConPunto={diasConHorarios ?? undefined}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
