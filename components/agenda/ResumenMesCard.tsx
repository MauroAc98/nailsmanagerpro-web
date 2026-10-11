'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowUpRight, Eye, EyeOff, ChevronUp, ChevronDown, Star, UserPlus } from 'lucide-react';
import { agendaColors, agendaShadows, agendaFontSerif } from '@/theme/agendaColors';
import { statsService, DashboardStats } from '@/services/statsService';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
import { formatMonto } from '@/lib/money';
import { rangoMesAnteriorMismoPeriodo, variacionPorcentual } from '@/lib/estadisticas/metricas';
import { useOcultarMonto } from '@/hooks/useOcultarMonto';

// Delega a formatoYMD (componentes LOCALES) — d.toISOString().split('T')[0]
// corre la fecha un día para atrás en husos negativos como ART/BRT (UTC-3)
// cuando `d` no es medianoche local.
function formatFecha(d: Date): string {
  return formatoYMD(d);
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

// Con qué se compara lo cobrado: el mes en curso contra el mismo tramo del
// mes anterior (día 1 a hoy); un mes cerrado contra el mes anterior entero.
function rangoDeComparacion(viewDate: Date, hoy: Date): { desde: string; hasta: string } {
  const mismoTramo = rangoMesAnteriorMismoPeriodo(viewDate, hoy);
  if (mismoTramo) return mismoTramo;
  return {
    desde: formatFecha(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)),
    hasta: formatFecha(new Date(viewDate.getFullYear(), viewDate.getMonth(), 0)),
  };
}

const recuadro: React.CSSProperties = {
  borderRadius: 14, padding: '10px 12px', boxSizing: 'border-box',
  backgroundColor: `color-mix(in srgb, ${agendaColors.surface} 75%, transparent)`,
  border: `1px solid color-mix(in srgb, ${agendaColors.primary} 15%, transparent)`,
};

// ─────────────────────────────────────────────
// ResumenMesCard — vistazo rápido del mes en el home (Agenda), sin repetir
// el detalle completo que ya vive en Configuración → Estadísticas. Todo lo
// que muestra habla de turnos: lo cobrado, cuántos se atendieron, cuántos
// faltan y los destacados. La ganancia con gastos queda en Estadísticas.
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
  // Lo cobrado en el período de comparación, con la misma clave: la
  // comparación es opcional y nunca se muestra contra otro mes.
  const [previo, setPrevio] = useState<{ key: string; ganancias: number } | null>(null);
  const [ocultarMonto, toggleOcultarMonto] = useOcultarMonto();

  const hoy = new Date();
  const esMesActual = viewDate.getFullYear() === hoy.getFullYear() && viewDate.getMonth() === hoy.getMonth();

  const statsKey = `${profesionalId ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;

  useEffect(() => {
    let cancelled = false;
    const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const key = `${profesionalId ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;
    const comparacion = rangoDeComparacion(viewDate, new Date());

    statsService.getDashboard(formatFecha(desde), formatFecha(hasta), profesionalId ?? undefined)
      .then(data => { if (!cancelled) { setStats(data); setLoadedKey(key); } })
      .catch(e => console.error('ResumenMesCard:', e));

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
  const variacion = previo?.key === statsKey ? variacionPorcentual(stats.ganancias, previo.ganancias) : null;
  const mesPrevio = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  const mes = nombreMes(viewDate, 'long');

  const numeros = [
    { valor: stats.turnos_por_estado.completados, etiqueta: t('attended'), color: agendaColors.strong },
    { valor: stats.turnos_por_estado.confirmados, etiqueta: t('upcoming'), color: agendaColors.strong },
    { valor: stats.turnos_por_estado.cancelados, etiqueta: t('cancelled'), color: agendaColors.muted },
  ];

  return (
    <button
      onClick={() => {
        const mesParam = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const params = new URLSearchParams({ mes: mesParam });
        if (profesionalId != null) params.set('profesional', String(profesionalId));
        router.push(`/configuracion/estadisticas?${params.toString()}`);
      }}
      style={{
        display: 'block', width: '100%', margin: '0 0 12px', padding: 18,
        background: `linear-gradient(135deg, ${agendaColors.primarySoft}, ${agendaColors.surface})`,
        border: `1px solid color-mix(in srgb, ${agendaColors.primary} 25%, transparent)`,
        boxShadow: agendaShadows.card, borderRadius: 24, cursor: 'pointer', textAlign: 'left',
        boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color={agendaColors.primaryDeep} strokeWidth={2.5} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: agendaColors.primaryDeep, textTransform: 'uppercase' }}>
            {esMesActual ? t('monthToDate', { mes }) : mes}
          </p>
        </div>
        <ArrowUpRight size={18} color={agendaColors.primaryDeep} strokeWidth={2} style={{ flexShrink: 0 }} />
      </div>

      {/* Lo principal: cuánto se cobró, y si viene mejor o peor que antes. */}
      <div style={{ marginTop: 14 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, color: agendaColors.sub }}>{t('collected')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* El monto es el dato principal — nunca se comprime. */}
          <p style={{ margin: 0, flexShrink: 0, fontSize: 32, lineHeight: 1, fontFamily: agendaFontSerif, fontWeight: 400, color: agendaColors.strong, whiteSpace: 'nowrap' }}>
            {ocultarMonto
              // Fila de puntos de ancho fijo (no un input type=password
              // ni un blur) — el patrón que usan Mercado Pago/Ualá para
              // tapar saldo. El "$" queda al tamaño real; solo los puntos
              // van más chicos.
              ? <>${' '}<span style={{ fontSize: 20, fontWeight: 400, letterSpacing: 3 }}>●●●●●</span></>
              : `$${formatMonto(stats.ganancias)}`}
          </p>
          <span
            onClick={toggleOcultarMonto}
            role="button"
            aria-label={ocultarMonto ? t('showAmount') : t('hideAmount')}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 4, margin: -4, flexShrink: 0 }}
          >
            {ocultarMonto
              ? <EyeOff size={16} color={agendaColors.sub} strokeWidth={2} />
              : <Eye size={16} color={agendaColors.sub} strokeWidth={2} />}
          </span>
          <span style={{ flex: 1 }} />
          {variacion !== null && !ocultarMonto && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, whiteSpace: 'nowrap',
              borderRadius: 20, padding: '3px 8px 3px 5px', fontSize: 11, fontWeight: 700,
              backgroundColor: variacion >= 0 ? agendaColors.successBg : agendaColors.amberBg,
              color: variacion >= 0 ? agendaColors.success : agendaColors.amberFg,
            }}>
              {variacion >= 0 ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
              {t('vsMonth', { pct: Math.abs(variacion), mes: nombreMes(mesPrevio, 'short', 'ninguna').replace('.', '') })}
            </span>
          )}
        </div>
      </div>

      {/* Cómo viene el mes en turnos: cada número con su palabra. */}
      <div style={{
        marginTop: 16, paddingTop: 14, display: 'flex', gap: 8,
        borderTop: `1px solid color-mix(in srgb, ${agendaColors.primary} 15%, transparent)`,
      }}>
        {numeros.map(n => (
          <div key={n.etiqueta} style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: n.color }}>{n.valor}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: agendaColors.sub }}>{n.etiqueta}</span>
          </div>
        ))}
      </div>

      {/* Destacados. El servicio más pedido (nombre cargado por el usuario,
          puede ser largo) se lee completo: baja de renglón en vez de
          cortarse. Clientes nuevos va al costado, chico y fijo. */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'stretch', gap: 8 }}>
        {topServicio && (
          <div style={{ ...recuadro, flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: agendaColors.primarySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Star size={14} color={agendaColors.primaryDeep} strokeWidth={2} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, color: agendaColors.sub }}>{t('topService')}</span>
              <span style={{ display: 'block', marginTop: 1, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: agendaColors.strong, overflowWrap: 'anywhere' }}>
                {topServicio}
              </span>
            </span>
          </div>
        )}
        <div style={{
          ...recuadro, flexShrink: 0, width: topServicio ? 92 : '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 16, fontWeight: 700, color: agendaColors.strong }}>
            <UserPlus size={14} color={agendaColors.primaryDeep} strokeWidth={2} />
            {stats.clientes.nuevas}
          </span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 11, lineHeight: 1.2, color: agendaColors.sub }}>{t('newClients')}</span>
        </div>
      </div>
    </button>
  );
}
