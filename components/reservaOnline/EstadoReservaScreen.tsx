'use client';

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getService, SLUGS_MOCK } from '@/lib/reservaOnline';
import type { ReservaOnlineService } from '@/lib/reservaOnline';
import { linkComoLlegar, linkGoogleCalendar } from '@/lib/reservaOnline/calendario';
import { esCheckoutUrlValida } from '@/lib/reservaOnline/checkoutUrl';
import { formatearRestante } from '@/lib/reservaOnline/cuentaRegresiva';
import { diaLargoCorto, fechaLarga } from '@/lib/reservaOnline/formatoFecha';
import { rutaPaso } from '@/lib/reservaOnline/rutas';
import { formatearDuracion } from '@/lib/reservaOnline/totales';
import { formatMontoCorto } from '@/lib/money';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useAhora, useCarga, type Ir } from './hooks';
import { IcoCalendario, IcoCheck, IcoPin, IcoReloj } from './iconos';
import { NoDisponibleAun } from './NoDisponibleAun';
import { Avatar, BarraInferior, BotonPrimario, Hueso, Mensaje, Tarjeta } from './ui';

const AZUL_MP = '#009ee3'; // color de marca de Mercado Pago (no es del tema)

// El mock expone simulatePayment (solo desarrollo) como propiedad EXTRA,
// fuera de las interfaces ReservaOnlineReads/Writes. Bug real encontrado en
// produccion: componerServicio() arma el servicio final con `{...mock, ...}`,
// asi que esa propiedad se cuela para CUALQUIER slug, no solo 'demo' — una
// clienta de un negocio real llegaba a ver el cartel de "Solo desarrollo" y
// el boton de simular pago en su propia pantalla. Por eso, ademas de que el
// metodo exista, se exige que el slug actual sea uno de los de SLUGS_MOCK.
type ConSimulacion = ReservaOnlineService & { simulatePayment?: (id: string) => Promise<void> };

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const tituloEstilo = { margin: '22px 0 8px', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, color: colors.strong } as const;
const textoEstilo = { fontSize: 14.5, color: colors.sub, lineHeight: 1.5 } as const;
const centrado = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '70px 12px 0' } as const;

// Esqueleto neutro: mientras carga no se sabe si la reserva esta pendiente,
// confirmada o vencida, asi que no imita ninguna de esas formas puntuales;
// solo el circulo/titulo centrados y la tarjeta que casi todas comparten.
function EstadoReservaSkeleton() {
  return (
    <div data-testid="estado-reserva-skeleton">
      <div style={centrado}>
        <Hueso w={84} h={84} r={42} />
        <Hueso w={180} h={22} style={{ marginTop: 22 }} />
        <Hueso w={220} h={14} style={{ marginTop: 10 }} />
      </div>
      <div style={{ paddingTop: 26 }}>
        <Tarjeta estilo={{ borderRadius: 16, padding: '14px 16px' }}>
          <Hueso w="55%" h={16} />
          <Hueso w="40%" h={13} style={{ marginTop: 8 }} />
        </Tarjeta>
      </div>
    </div>
  );
}

// Anillo circular con la cuenta regresiva mm:ss. `progreso` 0..1 = fraccion de
// la ventana de pago que queda (el arco verde se vacia con el tiempo).
function AnilloCuentaRegresiva({ restanteMs, totalMs }: { restanteMs: number; totalMs: number }) {
  const progreso = totalMs > 0 ? Math.min(1, Math.max(0, restanteMs / totalMs)) : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  return (
    <div
      role="timer"
      style={{
        position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: agendaFontSerif, fontSize: 22, color: colors.strong,
      }}
    >
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke={colors.border} strokeWidth="6" />
        <circle
          data-progreso={String(Number(progreso.toFixed(2)))}
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={colors.primarySolid}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progreso)}
        />
      </svg>
      {formatearRestante(restanteMs)}
    </div>
  );
}

function IconoCirculo({ fondo, children }: { fondo: string; children: ReactNode }) {
  return (
    <div style={{ width: 84, height: 84, borderRadius: 42, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  );
}

// Pantallas de pendiente / confirmado / vencido: una sola pagina dirigida por
// el estado de la reserva (D1), segura ante refresh. `ahora`/`cadaMs` son
// inyectables (tests). Sin totales: solo la sena (unico monto firme).
export function EstadoReservaScreen({
  slug,
  id,
  ir,
  ahora = Date.now,
  cadaMs = 1000,
  pollMs = 3000,
}: {
  slug: string;
  id: string;
  ir: Ir;
  ahora?: () => number;
  cadaMs?: number;
  pollMs?: number;
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

  // Auto-poll mientras esta pendiente: el redirect de MP vuelve casi al
  // toque, pero el webhook que confirma el pago es async y puede tardar unos
  // segundos mas — bug real reportado en produccion, la clienta quedaba
  // viendo "Esperando tu pago" para siempre a menos que tocara "Ya pagué" a
  // mano, aunque el pago ya estuviera aprobado y el turno confirmado.
  const pendiente = estado?.status === 'pending_payment';
  useEffect(() => {
    if (!pendiente) return;
    const intervalId = setInterval(reintentar, pollMs);
    return () => clearInterval(intervalId);
  }, [pendiente, pollMs, reintentar]);

  // Reserva confirmada: el flujo guardado ya no sirve.
  const confirmada = estado?.status === 'confirmed';
  useEffect(() => {
    if (confirmada) useReservaOnlineStore.getState().confirmar();
  }, [confirmada]);

  if (error) {
    // El kill switch del backend (RESERVAS_CREACION_HABILITADA=false) tambien
    // corta la lectura del estado: a pantalla completa, nunca "no encontrada".
    if (error.code === 'creation_disabled') return <NoDisponibleAun />;
    // Bug real: el polling automatico (o "Ya pague" tocado varias veces)
    // podia gatillar el limite de reservas-estado, y caia al error generico
    // en vez del aviso especifico que ya usan Horario/Resumen/Datos.
    if (error.code === 'rate_limited') return <Mensaje tono="error">{t('errores.limiteIntentos')}</Mensaje>;
    return <Mensaje tono="error">{error.code === 'not_found' ? t('estado.noEncontrada') : t('errores.generico')}</Mensaje>;
  }
  if (!data || !estado) return <EstadoReservaSkeleton />;

  const { salon, servicios, terminos } = data;
  const resumen = estado.summary;
  const nombresServicios = servicios.filter((s) => resumen.servicioIds.includes(s.id)).map((s) => s.nombre).join(' + ');
  const profesionalObj = salon.profesionales.find((p) => p.id === resumen.profesionalId);
  const profesional = profesionalObj?.nombre;

  if (estado.status === 'confirmed') {
    return (
      <div>
        <div style={{ ...centrado, padding: '36px 12px 0' }}>
          <div
            style={{
              width: 68, height: 68, borderRadius: 34, background: colors.primarySolid, boxShadow: `0 0 0 8px ${colors.primarySoft}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IcoCheck color={colors.primaryFg} size={34} sw={3} />
          </div>
          <h1 style={{ ...tituloEstilo, margin: '20px 0 4px', fontSize: 28 }}>{t('estado.confirmadaTitulo')}</h1>
          <div style={textoEstilo}>{t('estado.confirmadaDetalle', { salon: salon.nombre })}</div>
        </div>

        <div style={{ paddingTop: 22 }}>
          <div
            data-ticket=""
            style={{
              background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 18, overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(60, 40, 45, 0.08)',
            }}
          >
            <div
              style={{
                background: colors.primarySolid, padding: '14px 18px', color: colors.primaryFg,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  {fechaLarga(resumen.fecha, locale)}
                </div>
                <div style={{ fontFamily: agendaFontSerif, fontSize: 26, marginTop: 2 }}>{resumen.hora}</div>
              </div>
              <div style={{ fontSize: 12.5, textAlign: 'right', opacity: 0.9 }}>
                {formatearDuracion(resumen.duracionTotalMinutos)}
              </div>
            </div>
            {/* Fila propia, foto grande (48px): la version anterior metia un
                avatar de 20px pegado al "con Fernanda" del header y quedaba
                demasiado chico para que valiera la pena. */}
            {profesional && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${colors.border}` }}>
                <Avatar nombre={profesional} size={48} fotoUrl={profesionalObj?.avatarUrl} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.sub }}>
                    {t('estado.teAtiende')}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: colors.strong, marginTop: 1 }}>{profesional}</div>
                </div>
              </div>
            )}
            <div style={{ padding: '16px 18px', fontSize: 14, color: colors.text, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: colors.strong }}>{nombresServicios}</div>
              <div style={{ color: colors.sub, marginTop: 2 }}>
                {salon.direccion ? `${salon.nombre} · ${salon.direccion}` : salon.nombre}
              </div>
            </div>
            <div style={{ borderTop: `2px dashed ${colors.border}`, margin: '0 14px' }} />
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: colors.sub }}>{t('estado.senaPagada')}</span>
              <b style={{ color: colors.success }}>${formatMontoCorto(resumen.deposito)}</b>
            </div>
            <div style={{ padding: '0 18px 16px', fontSize: 12.5, color: colors.sub, lineHeight: 1.45 }}>
              {t('estado.valorFinal')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
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
              <IcoCalendario color={colors.primaryDeep} />
              {t('estado.agendar')}
            </a>
            {salon.direccion && (
              <a href={linkComoLlegar(salon.direccion)} target="_blank" rel="noopener noreferrer" style={accionEstilo}>
                <IcoPin color={colors.primaryDeep} />
                {t('estado.comoLlegar')}
              </a>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 12.5, color: colors.sub, marginTop: 18, lineHeight: 1.6 }}>
            {t('estado.cambiarNota', { horas: terminos.ventanaCancelacionHoras })}
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
      useReservaOnlineStore.getState().limpiarHorario();
      ir(rutaPaso(slug, 'horario'));
    };
    return (
      <div>
        <div style={centrado}>
          <IconoCirculo fondo={colors.amberBg}>
            <IcoReloj color={colors.amberFg} size={40} />
          </IconoCirculo>
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
  const simular = SLUGS_MOCK.includes(slug) ? svc.simulatePayment : undefined;
  const totalMs = terminos.ventanaPagoMinutos * 60_000;
  return (
    <div>
      <div style={centrado}>
        <AnilloCuentaRegresiva restanteMs={estado.expiresAtMs - reloj} totalMs={totalMs} />
        <h1 style={tituloEstilo}>{t('estado.pendienteTitulo')}</h1>
        <div style={textoEstilo}>{t('estado.pendienteDetalle')}</div>
      </div>
      <div style={{ paddingTop: 26 }}>
        <Tarjeta estilo={{ borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.strong }}>
            {capitalizar(diaLargoCorto(resumen.fecha, locale))} · {resumen.hora}
          </div>
          <div style={{ fontSize: 13, color: colors.sub, marginTop: 2 }}>
            {t('estado.senaLinea', { monto: `$${formatMontoCorto(resumen.deposito)}` })}
          </div>
        </Tarjeta>
      </div>
      {simular && (
        <div style={{ marginTop: 22, padding: 14, border: `1px dashed ${colors.border}`, borderRadius: 12, textAlign: 'center' }}>
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
      <BarraInferior>
        {estado.checkoutUrl && esCheckoutUrlValida(estado.checkoutUrl) && (
          <a
            href={estado.checkoutUrl}
            style={{
              height: 54, borderRadius: 16, background: AZUL_MP, color: '#fff', fontSize: 16, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
            }}
          >
            {t('estado.volverMp')}
          </a>
        )}
        <button
          type="button"
          onClick={reintentar}
          style={{
            display: 'block', margin: '14px auto 0', background: 'none', border: 'none', fontSize: 13, color: colors.sub,
            cursor: 'pointer',
          }}
        >
          {t('estado.yaPague')}
        </button>
      </BarraInferior>
    </div>
  );
}

const accionEstilo: CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 14,
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 13.5,
  fontWeight: 600,
  color: colors.strong,
  textDecoration: 'none',
};
