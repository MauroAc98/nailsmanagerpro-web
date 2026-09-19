'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { fechaLarga } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso, rutaReserva } from '@/lib/reservaOnline/rutas';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { duracionDeServicios, formatearDuracion } from '@/lib/reservaOnline/totales';
import { formatMontoCorto } from '@/lib/money';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, useHold, type Ir } from './hooks';
import { HoldVencido } from './HoldVencido';
import { IcoBrillo, IcoCalendario, IcoCandado, IcoPin, IcoReloj } from './iconos';
import { BarraInferior, BotonPrimario, HoldPill, Mensaje, PasoHeader, Tarjeta } from './ui';

const AZUL_MP = '#009ee3'; // color de marca de Mercado Pago (no es del tema)

// Fila de la tarjeta: icono en circulo suave + titulo y detalle.
function Fila({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle?: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 34, height: 34, borderRadius: 17, background: colors.primarySoft, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {icono}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.strong }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 13, color: colors.sub, marginTop: 2, lineHeight: 1.4 }}>{detalle}</div>}
      </div>
    </div>
  );
}

// Pantalla 5: resumen y pago de la sena. NO hay total: los servicios se listan
// sin precio y la sena es el unico monto firme. El horario ya esta retenido
// (paso anterior); "Pagar" inicia el pago sobre esa retencion (la extiende a la
// ventana de pago completa) y navega a la pagina de estado (el "checkout" de
// Mercado Pago es simulado en el slice 1). Con el hold vencido nunca se paga.
export function ResumenScreen({
  slug,
  ir,
  ahora = Date.now,
  cadaMs = 1000,
}: {
  slug: string;
  ir: Ir;
  ahora?: () => number;
  cadaMs?: number;
}) {
  const t = useTranslations('reservaOnline');
  const locale = useLocale();
  const listo = useGuardaPaso(slug, 'resumen', ir);
  const servicioIds = useReservaOnlineStore((s) => s.servicioIds);
  const fecha = useReservaOnlineStore((s) => s.fecha);
  const hora = useReservaOnlineStore((s) => s.hora);
  const nota = useReservaOnlineStore((s) => s.nota);
  const { hold, restanteMs, vencido } = useHold(ahora, cadaMs);
  const [enviando, setEnviando] = useState(false);
  const [holdPerdido, setHoldPerdido] = useState(false);
  const [errorPago, setErrorPago] = useState(false);

  const { data, error } = useCarga(async () => {
    const svc = getService();
    const [salon, servicios, terminos] = await Promise.all([
      svc.getSalon(slug),
      svc.getServices(slug),
      svc.getTerms(slug),
    ]);
    return { salon, servicios, terminos };
  }, `${slug}|${servicioIds.join(',')}`);

  if (!listo) return null;
  if (vencido || holdPerdido) return <HoldVencido slug={slug} ir={ir} />;
  if (error) return <Mensaje tono="error">{t('errores.generico')}</Mensaje>;
  if (!data || !fecha || !hora || !hold) return <Mensaje>{t('comun.cargando')}</Mensaje>;

  const { salon, servicios, terminos } = data;
  const elegidos = servicios.filter((s) => servicioIds.includes(s.id));
  const duracion = duracionDeServicios(servicios, servicioIds);
  const profesional = salon.profesionales.find((p) => p.id === hold.profesionalId);

  const pagar = async () => {
    setEnviando(true);
    setErrorPago(false);
    try {
      const pago = await getService().iniciarPago(slug, hold.reservaId);
      // Con Mercado Pago real aca se redirigiria a pago.checkoutUrl; el mock
      // devuelve directamente la pagina de estado de la reserva.
      ir(rutaReserva(slug, pago.id));
    } catch (e) {
      if (e instanceof ReservaOnlineError && e.code === 'hold_expired') setHoldPerdido(true);
      else setErrorPago(true);
      setEnviando(false);
    }
  };

  return (
    <div>
      <PasoHeader
        titulo={t('resumen.title')}
        paso={4}
        onVolver={() => ir(rutaPaso(slug, 'datos'))}
        pill={<HoldPill restanteMs={restanteMs} />}
      />

      <Tarjeta estilo={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Fila
            icono={<IcoCalendario color={colors.primaryDeep} />}
            titulo={`${fechaLarga(fecha, locale)} · ${hora}`}
            detalle={t('resumen.duracion', { duracion: formatearDuracion(duracion) })}
          />
          <Fila
            icono={<IcoBrillo color={colors.primaryDeep} />}
            titulo={elegidos.map((s) => s.nombre).join(' + ')}
            detalle={profesional ? t('resumen.conProfesional', { profesional: profesional.nombre }) : undefined}
          />
          <Fila
            icono={<IcoPin color={colors.primaryDeep} />}
            titulo={salon.nombre}
            detalle={salon.direccion ?? undefined}
          />
          {nota.trim() && <Fila icono={<IcoBrillo color={colors.primaryDeep} />} titulo={t('resumen.tuIdea')} detalle={nota.trim()} />}
        </div>
      </Tarjeta>

      <div style={{ height: 12 }} />
      <Tarjeta estilo={{ background: colors.successBg, borderColor: colors.successBorder, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.strong }}>{t('resumen.senaTitulo')}</span>
          <span style={{ fontFamily: agendaFontSerif, fontSize: 26, color: colors.strong }}>
            ${formatMontoCorto(terminos.deposito)}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 8, lineHeight: 1.5 }}>{t('resumen.senaDetalle')}</div>
      </Tarjeta>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, fontSize: 12.5, color: colors.sub }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IcoReloj color={colors.muted} size={15} />
          {t('resumen.tiempoPagar', { minutos: terminos.ventanaPagoMinutos })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <IcoCalendario color={colors.primaryDeep} />
          {t('resumen.cancelacion', { horas: terminos.ventanaCancelacionHoras })}
        </div>
      </div>

      {errorPago && <Mensaje tono="error">{t('errores.generico')}</Mensaje>}

      <BarraInferior>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 12, color: colors.muted, marginBottom: 10 }}>
          <IcoCandado color={colors.muted} size={14} />
          {t('resumen.pagoSeguro')}
        </div>
        <BotonPrimario fondo={AZUL_MP} disabled={enviando} onClick={pagar}>
          {enviando ? (
            t('resumen.pagando')
          ) : (
            <>
              {t('resumen.pagar')} <span style={{ fontWeight: 800 }}>Mercado Pago</span>
            </>
          )}
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
