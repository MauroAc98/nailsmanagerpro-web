'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowUpRight, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { agendaColors, agendaShadows, agendaFontSerif } from '@/theme/agendaColors';
import { statsService, DashboardStats } from '@/services/statsService';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
import { formatMontoEntero } from '@/lib/money';
import { rangoMesAnteriorMismoPeriodo, variacionPorcentual } from '@/lib/estadisticas/metricas';
import { useOcultarMonto } from '@/hooks/useOcultarMonto';

// Delega a formatoYMD (componentes LOCALES) — d.toISOString().split('T')[0]
// corre la fecha un día para atrás en husos negativos como ART/BRT (UTC-3)
// cuando `d` no es medianoche local.
function formatFecha(d: Date): string {
  return formatoYMD(d);
}

// Con qué se compara lo cobrado: el mes en curso contra los mismos días del
// mes pasado (lo que va del mes); un mes cerrado contra el anterior entero.
// El texto no lo aclara ("10% más que septiembre") para que entre corto.
function rangoDeComparacion(viewDate: Date, hoy: Date): { desde: string; hasta: string } {
  const mismoTramo = rangoMesAnteriorMismoPeriodo(viewDate, hoy);
  if (mismoTramo) return { desde: mismoTramo.desde, hasta: mismoTramo.hasta };
  return {
    desde: formatFecha(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)),
    hasta: formatFecha(new Date(viewDate.getFullYear(), viewDate.getMonth(), 0)),
  };
}

interface Props {
  // Mismo filtro de profesional que el resto de la pantalla de Agenda —
  // si el dueño está mirando solo a una profesional, el resumen la refleja.
  profesionalId: number | null;
  // Mismo mes que está navegando el calendario de abajo — si cambia de mes
  // ahí, el resumen tiene que seguirlo, si no queda mostrando datos de un
  // mes distinto al que se está mirando sin ningún aviso.
  viewDate: Date;
}

// ─────────────────────────────────────────────
// ResumenMesCard — vistazo rápido del mes en el home (Agenda), sin repetir
// el detalle completo que ya vive en Configuración → Estadísticas. Tiene que
// seguir siendo compacto: arriba de la semana, nunca la empuja fuera de la
// pantalla.
// ─────────────────────────────────────────────
export function ResumenMesCard({ profesionalId, viewDate }: Props) {
  const router = useRouter();
  const t = useTranslations('agenda.ResumenMesCard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  // Clave del mes/profesional que generó el `stats` cargado — se compara
  // contra `statsKey` (mes/profesional actuales) en el render. Sin esto, si
  // el fetch de un mes nuevo fallaba (red, token por expirar), la tarjeta
  // seguía mostrando la plata del mes VIEJO bajo el título del mes nuevo
  // (que sí se recalcula síncrono desde viewDate), sin ningún aviso de
  // error — plata mostrada con el período equivocado. `loadedKey` solo se
  // actualiza en el callback del fetch (no síncrono en el efecto), así que
  // un stats "stale" nunca pasa el chequeo del render aunque la request
  // todavía no haya resuelto o haya fallado.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Lo cobrado en el período de comparación, con la misma clave que `stats`:
  // es opcional y nunca se muestra contra el mes equivocado.
  const [previo, setPrevio] = useState<{ key: string; ganancias: number } | null>(null);
  const [ocultarMonto, toggleOcultarMonto] = useOcultarMonto();

  const statsKey = `${profesionalId ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;

  useEffect(() => {
    let cancelled = false;
    const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const key = `${profesionalId ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;

    statsService.getDashboard(formatFecha(desde), formatFecha(hasta), profesionalId ?? undefined)
      .then(data => { if (!cancelled) { setStats(data); setLoadedKey(key); } })
      .catch(e => console.error('ResumenMesCard:', e));

    const comparacion = rangoDeComparacion(viewDate, new Date());
    statsService.getDashboard(comparacion.desde, comparacion.hasta, profesionalId ?? undefined)
      .then(data => { if (!cancelled) setPrevio({ key, ganancias: data.ganancias }); })
      .catch(() => { /* la comparación es opcional: sin ella el card funciona igual */ });

    return () => { cancelled = true; };
  }, [profesionalId, viewDate]);

  // Sin datos todavía (cargando), datos de un mes/profesional distinto al
  // actual (fetch en vuelo o que falló), o sin ningún turno este mes: no
  // ocupar espacio en el home con una tarjeta vacía o con un dato viejo.
  if (!stats || loadedKey !== statsKey || stats.total_turnos === 0) return null;

  const topServicio = stats.servicios_mas_pedidos[0]?.nombre;
  const { completados, confirmados, cancelados } = stats.turnos_por_estado;
  const variacion = previo?.key === statsKey ? variacionPorcentual(stats.ganancias, previo.ganancias) : null;
  const mesPrevio = nombreMes(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1), 'long', 'ninguna');

  const divisor = `1px solid color-mix(in srgb, ${agendaColors.primary} 15%, transparent)`;
  // Los números del mes, cada uno con su rótulo debajo. Atendidos =
  // completados; por venir = confirmados (los vencidos se completan solos, ver
  // turnos:completar-vencidos). Antes acá iba total_turnos, que sumaba los
  // confirmados como completados.
  const numeros = [
    { valor: completados, rotulo: t('attended', { count: completados }) },
    { valor: confirmados, rotulo: t('upcoming') },
    { valor: stats.clientes.nuevas, rotulo: t('newClients', { count: stats.clientes.nuevas }) },
    { valor: cancelados, rotulo: t('cancelled', { count: cancelados }) },
  ];

  return (
    <button
      onClick={() => {
        const mes = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const params = new URLSearchParams({ mes });
        if (profesionalId != null) params.set('profesional', String(profesionalId));
        router.push(`/configuracion/estadisticas?${params.toString()}`);
      }}
      style={{
        display: 'block', width: '100%', margin: '0 0 12px', padding: '12px 14px',
        background: `linear-gradient(135deg, ${agendaColors.primarySoft}, ${agendaColors.surface})`,
        border: `1px solid color-mix(in srgb, ${agendaColors.primary} 25%, transparent)`,
        boxShadow: agendaShadows.card, borderRadius: 24, cursor: 'pointer', textAlign: 'left',
        boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={14} color={agendaColors.primaryDeep} strokeWidth={2.5} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: agendaColors.primaryDeep, textTransform: 'uppercase' }}>
            {t('summaryOf', { mes: nombreMes(viewDate, 'long', 'ninguna') })}
          </p>
        </div>
        <ArrowUpRight size={18} color={agendaColors.primaryDeep} strokeWidth={2} style={{ flexShrink: 0 }} />
      </div>

      {/* 1) Lo principal: cuánto se cobró y cómo viene contra el mes pasado.
          Mismo patrón que el resto del card: dato arriba, rótulo chico abajo. */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 26, lineHeight: 1, fontFamily: agendaFontSerif, fontWeight: 400, color: agendaColors.strong, fontVariantNumeric: 'tabular-nums' }}>
              {ocultarMonto
                // Fila de puntos de ancho fijo (no un input type=password
                // ni un blur) — el patrón que usan Mercado Pago/Ualá para
                // tapar saldo. El "$" queda al tamaño real (28, mismo que
                // con el monto visible) — solo los puntos van más chicos;
                // meterlo todo en un span más chico (intento anterior)
                // encogía el "$" también, que se veía raro/inconsistente.
                ? <>${' '}<span style={{ fontSize: 20, fontWeight: 400, letterSpacing: 3 }}>●●●●●</span></>
                : `$${formatMontoEntero(stats.ganancias)}`}
            </p>
            <span
              onClick={toggleOcultarMonto}
              role="button"
              aria-label={ocultarMonto ? t('showAmount') : t('hideAmount')}
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 4, margin: -4 }}
            >
              {ocultarMonto
                ? <EyeOff size={16} color={agendaColors.sub} strokeWidth={2} />
                : <Eye size={16} color={agendaColors.sub} strokeWidth={2} />}
            </span>
          </div>
          <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: agendaColors.sub }}>{t('collected')}</span>
        </div>
        {/* Se oculta junto con el monto: un porcentaje deja adivinar la plata. */}
        {variacion !== null && !ocultarMonto && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2, borderRadius: 20, padding: '3px 9px 3px 6px',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              backgroundColor: variacion >= 0 ? agendaColors.successBg : agendaColors.amberBg,
              color: variacion >= 0 ? agendaColors.success : agendaColors.amberFg,
            }}>
              {variacion >= 0 ? <ChevronUp size={13} strokeWidth={3} /> : <ChevronDown size={13} strokeWidth={3} />}
              {`${Math.abs(variacion)}%`}
            </span>
            <span style={{ marginTop: 2, fontSize: 11, color: agendaColors.sub, textAlign: 'right' }}>
              {t(variacion >= 0 ? 'moreThan' : 'lessThan', { mes: mesPrevio })}
            </span>
          </div>
        )}
      </div>

      {/* 2) Los números del mes: cuatro conteos en columnas. Cada columna
          toma el ancho de su rótulo (en un renglón): con columnas iguales
          "clientes nuevos" bajaba a dos y el card crecía. */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: divisor, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        {numeros.map((n, i) => (
          <div key={i} style={{ flex: '0 1 auto', minWidth: 0, ...(i > 0 ? { paddingLeft: 10, borderLeft: divisor } : {}) }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600, lineHeight: 1.15, color: agendaColors.strong, fontVariantNumeric: 'tabular-nums' }}>
              {n.valor}
            </span>
            <span style={{ display: 'block', marginTop: 1, fontSize: 11, lineHeight: 1.25, color: agendaColors.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.rotulo}</span>
          </div>
        ))}
      </div>

      {/* 3) El más pedido, en un renglón: "Más pedido: <servicio>". Es texto
          libre de largo variable: va último y a lo ancho, y si no entra baja
          de renglón sin desalinear nada ni cortarse. */}
      {topServicio && (
        <p style={{ margin: '8px 0 0', paddingTop: 8, borderTop: divisor, fontSize: 13, lineHeight: 1.35, color: agendaColors.sub, overflowWrap: 'anywhere' }}>
          {t('topServiceLabel')}{' '}
          <span style={{ fontWeight: 600, color: agendaColors.strong }}>{topServicio}</span>
        </p>
      )}
    </button>
  );
}
