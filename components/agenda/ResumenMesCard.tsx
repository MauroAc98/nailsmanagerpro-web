'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { agendaColors, agendaShadows } from '@/theme/agendaColors';
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

  const irAEstadisticas = () => {
    const mes = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams({ mes });
    if (profesionalId != null) params.set('profesional', String(profesionalId));
    router.push(`/configuracion/estadisticas?${params.toString()}`);
  };

  // Una sola línea (rediseño de jerarquía del home): mes, cantidad y monto.
  // El detalle (servicio top, clientas nuevas) vive en Estadísticas, a un
  // toque. El ojo es un botón hermano, no anidado dentro del que navega.
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 44, boxSizing: 'border-box',
      backgroundColor: agendaColors.surface, border: `1px solid ${agendaColors.border}`,
      borderRadius: 14, boxShadow: agendaShadows.card, overflow: 'hidden',
    }}>
      <button
        onClick={irAEstadisticas}
        aria-label={t('viewStats')}
        style={{
          flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 8px 0 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: agendaColors.sub, flexShrink: 0 }}>
          {nombreMes(viewDate, 'long')}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: agendaColors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span>{t('turnsCount', { count: stats.total_turnos })}</span>
          {' · '}
          <b style={{ fontWeight: 700 }}>
            {ocultarMonto ? '$ ●●●●●' : `$${formatMonto(stats.ganancias)}`}
          </b>
        </span>
        <ChevronRight size={16} color={agendaColors.muted} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      </button>
      <button
        onClick={toggleOcultarMonto}
        aria-label={ocultarMonto ? t('showAmount') : t('hideAmount')}
        style={{
          width: 44, height: '100%', flexShrink: 0, border: 'none', borderLeft: `1px solid ${agendaColors.hairline}`,
          background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {ocultarMonto
          ? <EyeOff size={16} color={agendaColors.sub} strokeWidth={2} />
          : <Eye size={16} color={agendaColors.sub} strokeWidth={2} />}
      </button>
    </div>
  );
}
