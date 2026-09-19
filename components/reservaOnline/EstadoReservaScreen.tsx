'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getService } from '@/lib/reservaOnline';
import type { ReservaOnlineService } from '@/lib/reservaOnline';
import { linkComoLlegar, linkGoogleCalendar } from '@/lib/reservaOnline/calendario';
import { formatearRestante } from '@/lib/reservaOnline/cuentaRegresiva';
import { fechaLarga } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { formatMontoCorto } from '@/lib/money';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useAhora, useCarga, type Ir } from './hooks';
import { BarraInferior, BotonPrimario, Mensaje, Tarjeta } from './ui';

// El mock expone simulatePayment (solo desarrollo); cuando el pago sea real
// el metodo desaparece de la composicion y la afordancia deja de mostrarse.
type ConSimulacion = ReservaOnlineService & { simulatePayment?: (id: string) => Promise<void> };

function Icono({ fondo, children }: { fondo: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 76, height: 76, borderRadius: 38, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  );
}

const tituloEstilo = { margin: '20px 0 6px', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, color: colors.strong } as const;
const textoEstilo = { fontSize: 14.5, color: colors.sub, lineHeight: 1.5 } as const;
const centrado = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '36px 12px 0' } as const;

// Pantallas 6/7 y pendiente: una sola pagina dirigida por el estado de la
// reserva (D1), segura ante refresh. `ahora`/`cadaMs` son inyectables (tests).
export function EstadoReservaScreen({
  slug,
  id,
  ir,
  ahora = Date.now,
  cadaMs = 1000,
}: {
  slug: string;
  id: string;
  ir: Ir;
  ahora?: () => number;
  cadaMs?: number;
}) {
  const t = useTranslations('reservaOnline');
  const locale = useLocale();
  const { data, error, reintentar } = useCarga(async () => {
    const svc = getService();
    const [estado, salon, servicios, terminos] = await Promise.all([
      svc.getReservationStatus(slug, id),
      svc.getSalon(slug),
      svc.getServices(slug),
      svc.getTerms(slug),
    ]);
    return { estado, salon, servicios, terminos };
  }, `${slug}|${id}`);
  const reloj = useAhora(ahora, cadaMs);

  const estado = data?.estado;
  const vencioLaVentana = estado?.status === 'pending_payment' && reloj >= estado.expiresAtMs;

  // Al cruzar el vencimiento se vuelve a pedir el estado: el servidor decide.
  useEffect(() => {
    if (vencioLaVentana) reintentar();
  }, [vencioLaVentana, reintentar]);

  // Reserva confirmada: el flujo guardado ya no sirve.
  const confirmada = estado?.status === 'confirmed';
  useEffect(() => {
    if (confirmada) useReservaOnlineStore.getState().confirmar();
  }, [confirmada]);

  if (error) {
    return <Mensaje tono="error">{error.code === 'not_found' ? t('estado.noEncontrada') : t('errores.generico')}</Mensaje>;
  }
  if (!data || !estado) return <Mensaje>{t('comun.cargando')}</Mensaje>;

  const { salon, servicios, terminos } = data;
  const resumen = estado.summary;
  const resto = Math.max(0, resumen.total - resumen.deposito);
  const nombresServicios = servicios.filter((s) => resumen.servicioIds.includes(s.id)).map((s) => s.nombre).join(' + ');
  const profesional = salon.profesionales.find((p) => p.id === resumen.profesionalId)?.nombre;

  if (estado.status === 'confirmed') {
    return (
      <div>
        <div style={centrado}>
          <Icono fondo={colors.primarySolid}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={colors.primaryFg} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </Icono>
          <h1 style={{ ...tituloEstilo, fontSize: 28 }}>{t('estado.confirmadaTitulo')}</h1>
          <div style={textoEstilo}>{t('estado.confirmadaDetalle', { salon: salon.nombre })}</div>
        </div>
        <div style={{ paddingTop: 24 }}>
          <Tarjeta>
            <div style={{ fontFamily: agendaFontSerif, fontSize: 20, color: colors.strong }}>
              {fechaLarga(resumen.fecha, locale)} · {resumen.hora}
            </div>
            <div style={{ fontSize: 14, color: colors.sub, marginTop: 2 }}>
              {nombresServicios}
              {profesional ? ` · ${profesional}` : ''}
            </div>
            <div style={{ height: 1, background: colors.border, margin: '14px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: colors.text, marginBottom: 6 }}>
              <span>{t('estado.senaPagada')}</span>
              <b style={{ color: colors.success }}>${formatMontoCorto(resumen.deposito)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: colors.text }}>
              <span>{t('estado.restaAbonar')}</span>
              <b>${formatMontoCorto(resto)}</b>
            </div>
          </Tarjeta>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <a
              href={linkGoogleCalendar({
                titulo: salon.nombre,
                fecha: resumen.fecha,
                hora: resumen.hora,
                duracionMinutos: resumen.duracionTotalMinutos,
                ubicacion: salon.direccion,
              })}
              target="_blank"
              rel="noopener noreferrer"
              style={accionEstilo}
            >
              {t('estado.agendar')}
            </a>
            {salon.direccion && (
              <a href={linkComoLlegar(salon.direccion)} target="_blank" rel="noopener noreferrer" style={accionEstilo}>
                {t('estado.comoLlegar')}
              </a>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 13, color: colors.sub, marginTop: 22, lineHeight: 1.6 }}>
            {t('estado.cancelarNota', { horas: terminos.ventanaCancelacionHoras })}
          </div>
        </div>
      </div>
    );
  }

  if (estado.status === 'expired' || vencioLaVentana) {
    const otroHorario = () => {
      // Conserva servicios/profesional/datos: solo se descarta el horario vencido.
      const s = useReservaOnlineStore.getState();
      if (s.slug !== slug) s.activarSlug(slug);
      useReservaOnlineStore.getState().setProfesional(useReservaOnlineStore.getState().profesionalId);
      ir(rutaPaso(slug, 'horario'));
    };
    return (
      <div>
        <div style={centrado}>
          <Icono fondo={colors.amberBg}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={colors.amberFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </Icono>
          <h1 style={tituloEstilo}>{t('estado.vencidaTitulo')}</h1>
          <div style={textoEstilo}>{t('estado.vencidaDetalle', { hora: resumen.hora })}</div>
        </div>
        <BarraInferior>
          <BotonPrimario onClick={otroHorario}>{t('estado.elegirOtro')}</BotonPrimario>
          <button
            type="button"
            onClick={() => ir(rutaPaso(slug))}
            style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: colors.primaryDeep, cursor: 'pointer' }}
          >
            {t('estado.volverInicio')}
          </button>
        </BarraInferior>
      </div>
    );
  }

  if (estado.status === 'cancelled') {
    return (
      <div style={centrado}>
        <h1 style={tituloEstilo}>{t('estado.canceladaTitulo')}</h1>
      </div>
    );
  }

  // pending_payment
  const svc = getService() as ConSimulacion;
  const simular = svc.simulatePayment;
  return (
    <div>
      <div style={centrado}>
        <Icono fondo={colors.amberBg}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={colors.amberFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
        </Icono>
        <h1 style={tituloEstilo}>{t('estado.pendienteTitulo')}</h1>
        <div style={textoEstilo}>
          {t('estado.pendienteDetalle', { restante: formatearRestante(estado.expiresAtMs - reloj) })}
        </div>
      </div>
      {simular && (
        <div style={{ marginTop: 28, padding: 14, border: `1px dashed ${colors.border}`, borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted }}>
            {t('dev.titulo')}
          </div>
          <div style={{ fontSize: 12.5, color: colors.sub, margin: '6px 0 10px' }}>{t('dev.nota')}</div>
          <button
            type="button"
            onClick={() => simular(id).then(reintentar)}
            style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.strong, fontWeight: 600, cursor: 'pointer' }}
          >
            {t('dev.simularPago')}
          </button>
        </div>
      )}
    </div>
  );
}

const accionEstilo = {
  flex: 1,
  height: 48,
  borderRadius: 12,
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 600,
  color: colors.strong,
  textDecoration: 'none',
} as const;
