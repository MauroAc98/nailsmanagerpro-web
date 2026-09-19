'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import { fechaLarga } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso, rutaReserva } from '@/lib/reservaOnline/rutas';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { totalesDeServicios } from '@/lib/reservaOnline/totales';
import { formatMontoCorto } from '@/lib/money';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, type Ir } from './hooks';
import { BarraInferior, BotonPrimario, Mensaje, PasoHeader, Tarjeta } from './ui';

const AZUL_MP = '#009ee3'; // color de marca de Mercado Pago (no es del tema)

const linea = { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: colors.text };
const separador = { height: 1, background: colors.border, margin: '14px 0' };

// Pantalla 5: resumen y pago de la sena. Crea la reserva pendiente y navega a
// su pagina de estado (en el slice 1 el "checkout" de Mercado Pago es simulado).
export function ResumenScreen({ slug, ir }: { slug: string; ir: Ir }) {
  const t = useTranslations('reservaOnline');
  const locale = useLocale();
  const listo = useGuardaPaso(slug, 'resumen', ir);
  const flujo = useReservaOnlineStore();
  const [enviando, setEnviando] = useState(false);
  const [errorPago, setErrorPago] = useState<'tomado' | 'generico' | null>(null);

  const { data, error } = useCarga(async () => {
    const svc = getService();
    const { servicioIds, profesionalId, fecha, hora } = useReservaOnlineStore.getState();
    const [salon, servicios, terminos, disp] = await Promise.all([
      svc.getSalon(slug),
      svc.getServices(slug),
      svc.getTerms(slug),
      fecha
        ? svc.getAvailability(slug, {
            fecha,
            servicioIds,
            profesionalId: profesionalId === 'any' ? undefined : profesionalId,
          })
        : Promise.resolve(null),
    ]);
    // Profesional que atendera: la elegida o la primera libre a esa hora.
    const slot = disp?.slots.find((s) => s.hora === hora);
    const profesionalResuelto =
      slot === undefined ? null : profesionalId === 'any' ? slot.profesionalIds[0] : profesionalId;
    return { salon, servicios, terminos, profesionalResuelto, duracion: disp?.duracionTotalMinutos ?? 0 };
  }, `${slug}|${flujo.servicioIds.join(',')}|${flujo.profesionalId}|${flujo.fecha}|${flujo.hora}`);

  if (!listo) return null;
  if (error) return <Mensaje tono="error">{t('errores.generico')}</Mensaje>;
  if (!data || !flujo.fecha || !flujo.hora) return <Mensaje>{t('comun.cargando')}</Mensaje>;

  const { salon, servicios, terminos, profesionalResuelto, duracion } = data;
  const elegidos = servicios.filter((s) => flujo.servicioIds.includes(s.id));
  const total = totalesDeServicios(servicios, flujo.servicioIds).precio;
  const resto = Math.max(0, total - terminos.deposito);
  const profesional = salon.profesionales.find((p) => p.id === profesionalResuelto);
  const horarioTomado = profesionalResuelto === null || errorPago === 'tomado';

  const pagar = async () => {
    if (profesionalResuelto === null || !flujo.fecha || !flujo.hora) return;
    setEnviando(true);
    setErrorPago(null);
    try {
      const creada = await getService().createReservation(slug, {
        servicioIds: flujo.servicioIds,
        profesionalId: profesionalResuelto,
        fecha: flujo.fecha,
        hora: flujo.hora,
        cliente: flujo.cliente,
      });
      flujo.setReservaId(creada.id);
      // Con Mercado Pago real aca se redirigiria a creada.checkoutUrl; el mock
      // devuelve directamente la pagina de estado de la reserva.
      ir(rutaReserva(slug, creada.id));
    } catch (e) {
      setErrorPago(e instanceof ReservaOnlineError && e.code === 'slot_taken' ? 'tomado' : 'generico');
      setEnviando(false);
    }
  };

  return (
    <div>
      <PasoHeader titulo={t('resumen.title')} paso={4} onVolver={() => ir(rutaPaso(slug, 'datos'))} />

      <Tarjeta>
        <div style={{ fontFamily: agendaFontSerif, fontSize: 20, color: colors.strong }}>
          {fechaLarga(flujo.fecha, locale)}
        </div>
        <div style={{ fontSize: 14, color: colors.sub, marginTop: 2 }}>
          {t('resumen.conProfesional', {
            hora: flujo.hora,
            profesional: profesional?.nombre ?? '',
            minutos: duracion,
          })}
        </div>
        <div style={separador} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {elegidos.map((s) => (
            <div key={s.id} style={linea}>
              <span>{s.nombre}</span>
              <span>${formatMontoCorto(s.precio)}</span>
            </div>
          ))}
        </div>
        <div style={separador} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, color: colors.sub }}>{t('resumen.total')}</span>
          <span style={{ fontFamily: agendaFontSerif, fontSize: 20, color: colors.strong }}>
            ${formatMontoCorto(total)}
          </span>
        </div>
      </Tarjeta>

      <div style={{ height: 12 }} />
      <Tarjeta estilo={{ background: colors.successBg, borderColor: colors.successBorder }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: colors.strong }}>{t('resumen.senaTitulo')}</span>
          <span style={{ fontFamily: agendaFontSerif, fontSize: 24, color: colors.strong }}>
            ${formatMontoCorto(terminos.deposito)}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: colors.sub, marginTop: 6, lineHeight: 1.5 }}>
          {t('resumen.senaDetalle', {
            resto: `$${formatMontoCorto(resto)}`,
            minutos: terminos.ventanaPagoMinutos,
          })}
        </div>
      </Tarjeta>

      {horarioTomado && <Mensaje tono="error">{t('resumen.horarioTomado')}</Mensaje>}
      {errorPago === 'generico' && <Mensaje tono="error">{t('errores.generico')}</Mensaje>}

      <BarraInferior>
        {horarioTomado ? (
          <BotonPrimario onClick={() => ir(rutaPaso(slug, 'horario'))}>{t('resumen.elegirOtro')}</BotonPrimario>
        ) : (
          <>
            <BotonPrimario fondo={AZUL_MP} disabled={enviando} onClick={pagar}>
              {enviando ? (
                t('resumen.pagando')
              ) : (
                <>
                  {t('resumen.pagar')} <span style={{ fontWeight: 800 }}>Mercado Pago</span>
                </>
              )}
            </BotonPrimario>
            <div style={{ textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 10 }}>
              {t('resumen.pagoSeguro')}
            </div>
          </>
        )}
      </BarraInferior>
    </div>
  );
}
