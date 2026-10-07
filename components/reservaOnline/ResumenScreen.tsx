'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { esRedirectSeguro } from '@/lib/esRedirectSeguro';
import { getService } from '@/lib/reservaOnline';
import { esCheckoutUrlValida } from '@/lib/reservaOnline/checkoutUrl';
import { fechaLarga } from '@/lib/reservaOnline/formatoFecha';
import { formatearWhatsapp } from '@/lib/reservaOnline/formatoWhatsapp';
import { rutaPaso, rutaReserva } from '@/lib/reservaOnline/rutas';
import { ReservaOnlineError } from '@/lib/reservaOnline/service';
import { duracionDeServicios, formatearDuracion } from '@/lib/reservaOnline/totales';
import { formatMontoCorto } from '@/lib/money';
import { Spinner } from '@/components/Spinner';
import { useReservaOnlineStore } from '@/store/useReservaOnlineStore';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { useCarga, useGuardaPaso, useHold, type Ir } from './hooks';
import { HoldVencido } from './HoldVencido';
import { IcoBrillo, IcoCalendario, IcoCandado, IcoPin, IcoReloj } from './iconos';
import { NoDisponibleAun } from './NoDisponibleAun';
import { RedirigiendoAMercadoPago } from './RedirigiendoAMercadoPago';
import { ServiciosDelTurno } from './ServiciosDelTurno';
import { BarraInferior, BotonPrimario, HoldPill, Hueso, Mensaje, PasoHeader, Tarjeta } from './ui';

const AZUL_MP = '#009ee3'; // color de marca de Mercado Pago (no es del tema)

// Un monto solo es mostrable si es finito y positivo: nunca $0, $null ni NaN.
const montoValido = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;

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

const rotuloEstilo = {
  margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: colors.sub, textTransform: 'uppercase',
} as const;

// Fila de la tarjeta con huesos, misma forma que `Fila` (circulo + 2 lineas).
function FilaHueso() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Hueso w={34} h={34} r={17} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Hueso w="70%" h={14} />
        <Hueso w="45%" h={12} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

// Forma del layout real (tarjeta de resumen con 3 filas + tarjeta de sena),
// para que no salte nada al llegar los datos.
function ResumenSkeleton() {
  return (
    <div data-testid="resumen-skeleton">
      <Tarjeta estilo={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FilaHueso />
          <FilaHueso />
          <FilaHueso />
        </div>
      </Tarjeta>
      <div style={{ height: 12 }} />
      <Tarjeta estilo={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Hueso w={110} h={14} />
          <Hueso w={64} h={26} />
        </div>
        <Hueso w="85%" h={12} style={{ marginTop: 12 }} />
      </Tarjeta>
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
  const asignaciones = useReservaOnlineStore((s) => s.asignaciones);
  const fecha = useReservaOnlineStore((s) => s.fecha);
  const hora = useReservaOnlineStore((s) => s.hora);
  const nota = useReservaOnlineStore((s) => s.nota);
  const cliente = useReservaOnlineStore((s) => s.cliente);
  const { hold, restanteMs, vencido } = useHold(ahora, cadaMs);
  const [enviando, setEnviando] = useState(false);
  const [holdPerdido, setHoldPerdido] = useState(false);
  const [errorPago, setErrorPago] = useState(false);
  const [limiteIntentos, setLimiteIntentos] = useState(false);
  const [senaSinTotal, setSenaSinTotal] = useState(false);
  // Kill switch del backend apagado: a pantalla completa, como en Horario/Datos.
  const [noDisponible, setNoDisponible] = useState(false);
  // El negocio desactivó la reserva online (404): reintentar no sirve.
  const [sinReservas, setSinReservas] = useState(false);

  const { data, error } = useCarga(async () => {
    const svc = getService();
    const [salon, servicios, terminos] = await Promise.all([
      svc.getSalon(slug),
      svc.getServices(slug),
      svc.getTerms(slug),
    ]);
    return { salon, servicios, terminos };
  }, `${slug}|${servicioIds.join(',')}`);

  // Seña por porcentaje sin monto en los terminos: el monto exacto sale de la
  // reserva retenida (el backend lo calcula sobre el precio congelado del hold y
  // es lo mismo que cobra Mercado Pago). Con seña fija no se consulta nada.
  const terminosDatos = data?.terminos;
  const montoDeTerminos = montoValido(terminosDatos?.deposito);
  const buscaMonto = terminosDatos?.senaTipo === 'porcentaje' && montoDeTerminos === null && !!hold;
  const reservaId = hold?.reservaId;
  const { data: resumenReserva, cargando: cargandoMonto } = useCarga(async () => {
    if (!buscaMonto || !reservaId) return null;
    try {
      const estado = await getService().getReservationStatus(slug, reservaId);
      return { deposito: montoValido(estado.summary.deposito) };
    } catch {
      return { deposito: null };
    }
  }, `${slug}|${reservaId ?? ''}|${buscaMonto}`);

  if (!listo) return null;
  // Reemplaza TODA la pantalla (header, boton volver, barra inferior
  // incluidos) desde que se toca "Pagar" hasta que el navegador efectivamente
  // sale hacia Mercado Pago: sin esto el unico cambio visible era el texto
  // del boton, la pantalla se sentia "congelada" y el boton volver seguia
  // tocable, dejando reprogramar/perder el hold a mitad de una navegacion ya
  // en curso.
  if (enviando) return <RedirigiendoAMercadoPago />;
  if (noDisponible) return <NoDisponibleAun />;
  if (sinReservas || error?.code === 'not_found') return <NoDisponibleAun variante="negocio" />;
  if (vencido || holdPerdido) return <HoldVencido slug={slug} ir={ir} />;
  if (error) return <Mensaje tono="error">{t('errores.generico')}</Mensaje>;
  if (!data || !fecha || !hora || !hold) return <ResumenSkeleton />;

  const { salon, servicios, terminos } = data;
  // Monto firme de la seña, o null si no se conoce (porcentaje sin total, 0 o dato invalido):
  // nunca se muestra un $0, un $null ni un NaN como si fuera un precio.
  const montoSena = montoDeTerminos ?? resumenReserva?.deposito ?? null;
  const esPorcentaje = terminos.senaTipo === 'porcentaje';
  const calculandoMonto = esPorcentaje && montoSena === null && (cargandoMonto || (buscaMonto && !resumenReserva));
  // En porcentaje nunca se paga a ciegas: sin monto exacto el boton queda inactivo.
  const pagoBloqueado = esPorcentaje && montoSena === null;
  const senaNoCalculable = pagoBloqueado && !calculandoMonto;
  const elegidos = servicioIds
    .map((id) => servicios.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const duracion = duracionDeServicios(servicios, servicioIds);
  // Quien hace cada servicio: la del grupo si la clienta repartio, si no la que
  // quedo asignada al retener el horario (la elegida o, con "Cualquiera", la primera libre).
  const profesionalDe = (servicioId: number) => {
    const id = asignaciones?.find((g) => g.servicioIds.includes(servicioId))?.profesionalId ?? hold.profesionalId;
    return salon.profesionales.find((p) => p.id === id);
  };

  const pagar = async () => {
    setEnviando(true);
    setErrorPago(false);
    setLimiteIntentos(false);
    setSenaSinTotal(false);
    try {
      const pago = await getService().iniciarPago(slug, hold.reservaId);
      if (esRedirectSeguro(pago.checkoutUrl)) {
        // Adapter mock (slug demo): checkoutUrl es un path interno propio,
        // la pagina de estado ya simula el pago — se sigue navegando adentro
        // de la SPA, sin salir del origen.
        ir(rutaReserva(slug, pago.id));
      } else if (esCheckoutUrlValida(pago.checkoutUrl)) {
        // Mercado Pago real: checkoutUrl es el link de pago de MP, en otro
        // origen — ir() (router de Next) no puede navegar ahi, hace falta
        // una navegacion de navegador de verdad.
        window.location.href = pago.checkoutUrl;
      } else {
        // Nunca deberia pasar (el backend solo devuelve un path interno o un
        // https:// de MP) — no redirigir a algo sin verificar.
        setErrorPago(true);
        setEnviando(false);
      }
    } catch (e) {
      if (e instanceof ReservaOnlineError && e.code === 'hold_expired') setHoldPerdido(true);
      // mp_no_conectado: en teoria EntryScreen ya corta el paso antes de
      // llegar aca (salon.pagoHabilitado), pero MP pudo desconectarse
      // mientras la clienta completaba el formulario — mismo bloqueo de
      // pantalla completa que el kill switch, nunca el error generico.
      else if (e instanceof ReservaOnlineError && (e.code === 'creation_disabled' || e.code === 'mp_no_conectado')) setNoDisponible(true);
      else if (e instanceof ReservaOnlineError && e.code === 'not_found') setSinReservas(true);
      else if (e instanceof ReservaOnlineError && e.code === 'rate_limited') setLimiteIntentos(true);
      else if (e instanceof ReservaOnlineError && e.code === 'sena_sin_total') setSenaSinTotal(true);
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
        <p style={rotuloEstilo}>{t('resumen.tuTurno')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Fila
            icono={<IcoCalendario color={colors.primaryDeep} />}
            titulo={`${fechaLarga(fecha, locale)} · ${hora}`}
            detalle={t('resumen.duracion', { duracion: formatearDuracion(duracion) })}
          />
          {hold.fin && (
            <div style={{ fontSize: 13, color: colors.sub, marginTop: -8 }}>
              {t.rich('horario.ocupaRango', {
                inicio: hora,
                fin: hold.fin,
                b: (chunks) => <b style={{ color: colors.strong }}>{chunks}</b>,
              })}
            </div>
          )}
        </div>
      </Tarjeta>

      <div style={{ height: 12 }} />
      <Tarjeta estilo={{ borderRadius: 16 }}>
        <p style={rotuloEstilo}>{t('resumen.servicios')}</p>
        <ServiciosDelTurno servicios={elegidos} profesionalDe={profesionalDe} />
      </Tarjeta>

      <div style={{ height: 12 }} />
      <Tarjeta estilo={{ borderRadius: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Fila
            icono={<IcoPin color={colors.primaryDeep} />}
            titulo={salon.nombre}
            detalle={salon.direccion ?? undefined}
          />
          {nota.trim() && <Fila icono={<IcoBrillo color={colors.primaryDeep} />} titulo={t('resumen.tuIdea')} detalle={nota.trim()} />}
        </div>
      </Tarjeta>

      <div style={{ height: 12 }} />
      {/* Un digito mal tipeado manda la confirmacion a un numero sin WhatsApp:
          se muestra el numero (dato personal: solo en pantalla, sin log) con
          salida directa a corregirlo; lo tipeado queda en el store. */}
      {cliente.whatsapp && (
        <>
          <Tarjeta estilo={{ borderRadius: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: colors.sub, lineHeight: 1.4 }}>{t('resumen.whatsappConfirmacion')}</div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: colors.strong, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {formatearWhatsapp(cliente.whatsapp)}
                </div>
              </div>
              <button
                type="button"
                aria-label={t('resumen.editarWhatsappLabel')}
                onClick={() => ir(rutaPaso(slug, 'datos'))}
                style={{
                  flexShrink: 0, minHeight: 44, padding: '0 14px', cursor: 'pointer', background: colors.surface,
                  border: `1.5px solid ${colors.border}`, borderRadius: 12, fontSize: 14, fontWeight: 600, color: colors.primaryDeep,
                }}
              >
                {t('resumen.editarWhatsapp')}
              </button>
            </div>
          </Tarjeta>
          <div style={{ height: 12 }} />
        </>
      )}
      <Tarjeta estilo={{ background: colors.successBg, borderColor: colors.successBorder, borderRadius: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ minWidth: 0, fontSize: 14, fontWeight: 700, color: colors.strong }}>{t('resumen.senaTitulo')}</span>
          {montoSena !== null && (
            <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontFamily: agendaFontSerif, fontSize: 26, color: colors.strong }}>
              ${formatMontoCorto(montoSena)}
            </span>
          )}
          {calculandoMonto && <Spinner size={22} label={t('resumen.senaCalculando')} />}
        </div>
        {terminos.senaTipo === 'porcentaje' && terminos.senaPorcentaje != null && (
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.strong, marginTop: 4 }}>
            {t('resumen.senaPorcentaje', { porcentaje: formatMontoCorto(terminos.senaPorcentaje) })}
          </div>
        )}
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

      {limiteIntentos && <Mensaje tono="error">{t('errores.limiteIntentos')}</Mensaje>}
      {(senaSinTotal || senaNoCalculable) && <Mensaje tono="error">{t('errores.senaSinTotal')}</Mensaje>}
      {errorPago && <Mensaje tono="error">{t('errores.generico')}</Mensaje>}

      <BarraInferior>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 12, color: colors.muted, marginBottom: 10 }}>
          <IcoCandado color={colors.muted} size={14} />
          {t('resumen.pagoSeguro')}
        </div>
        {/* enviando ya no se refleja aca: mientras es true, el early return
            de arriba reemplaza toda la pantalla por RedirigiendoAMercadoPago
            (este boton nunca llega a pintarse en ese estado). */}
        <BotonPrimario fondo={AZUL_MP} onClick={pagar} disabled={pagoBloqueado}>
          {t('resumen.pagar')} <span style={{ fontWeight: 800 }}>Mercado Pago</span>
        </BotonPrimario>
      </BarraInferior>
    </div>
  );
}
