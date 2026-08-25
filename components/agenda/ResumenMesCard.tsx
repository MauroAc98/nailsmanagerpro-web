'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { agendaColors, agendaShadows, agendaFontSerif } from '@/theme/agendaColors';
import { statsService, DashboardStats } from '@/services/statsService';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
import { formatMonto } from '@/lib/money';
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

// ─────────────────────────────────────────────
// ResumenMesCard — vistazo rápido del mes en el home (Agenda), sin repetir
// el detalle completo que ya vive en Configuración → Estadísticas.
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
  const [ocultarMonto, toggleOcultarMonto] = useOcultarMonto();

  const esMesActual = viewDate.getFullYear() === new Date().getFullYear()
    && viewDate.getMonth() === new Date().getMonth();

  const statsKey = `${profesionalId ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;

  useEffect(() => {
    let cancelled = false;
    const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const key = `${profesionalId ?? 'all'}:${viewDate.getFullYear()}-${viewDate.getMonth()}`;

    statsService.getDashboard(formatFecha(desde), formatFecha(hasta), profesionalId ?? undefined)
      .then(data => { if (!cancelled) { setStats(data); setLoadedKey(key); } })
      .catch(e => console.error('ResumenMesCard:', e));

    return () => { cancelled = true; };
  }, [profesionalId, viewDate]);

  // Sin datos todavía (cargando), datos de un mes/profesional distinto al
  // actual (fetch en vuelo o que falló), o sin ningún turno este mes: no
  // ocupar espacio en el home con una tarjeta vacía o con un dato viejo.
  if (!stats || loadedKey !== statsKey || stats.total_turnos === 0) return null;

  const topServicio = stats.servicios_mas_pedidos[0]?.nombre;

  return (
    <button
      onClick={() => {
        const mes = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const params = new URLSearchParams({ mes });
        if (profesionalId != null) params.set('profesional', String(profesionalId));
        router.push(`/configuracion/estadisticas?${params.toString()}`);
      }}
      style={{
        display: 'block', width: '100%', margin: '0 0 12px', padding: '16px 18px',
        background: `linear-gradient(135deg, ${agendaColors.primarySoft}, ${agendaColors.surface})`,
        border: `1px solid color-mix(in srgb, ${agendaColors.primary} 25%, transparent)`,
        boxShadow: agendaShadows.card, borderRadius: 24, cursor: 'pointer', textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={14} color={agendaColors.primaryDeep} strokeWidth={2.5} />
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: agendaColors.primaryDeep, textTransform: 'uppercase' }}>
            {esMesActual ? t('statsThisMonth') : t('statsOfMonth', { mes: nombreMes(viewDate, 'long', 'ninguna') })}
          </p>
        </div>
        <ArrowUpRight size={18} color={agendaColors.primaryDeep} strokeWidth={2} style={{ flexShrink: 0 }} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 28, lineHeight: 1, fontFamily: agendaFontSerif, fontWeight: 400, color: agendaColors.strong }}>
              {ocultarMonto
                // Fila de puntos de ancho fijo (no un input type=password
                // ni un blur) — el patrón que usan Mercado Pago/Ualá para
                // tapar saldo. El "$" queda al tamaño real (28, mismo que
                // con el monto visible) — solo los puntos van más chicos;
                // meterlo todo en un span más chico (intento anterior)
                // encogía el "$" también, que se veía raro/inconsistente.
                ? <>${' '}<span style={{ fontSize: 20, fontWeight: 400, letterSpacing: 3 }}>●●●●●</span></>
                : `$${formatMonto(stats.ganancias)}`}
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
          <p style={{ margin: '4px 0 0', fontSize: 12, color: agendaColors.sub }}>
            {t('appointmentsCompleted', { count: stats.total_turnos })}
          </p>
        </div>
        {topServicio && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: agendaColors.text }}>{topServicio}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: agendaColors.sub }}>{t('topServiceLabel')}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid color-mix(in srgb, ${agendaColors.primary} 15%, transparent)` }}>
        <p style={{ margin: 0, fontSize: 12, color: agendaColors.sub }}>
          {t('newClientsThisMonth', { count: stats.clientes.nuevas })}
        </p>
      </div>
    </button>
  );
}
