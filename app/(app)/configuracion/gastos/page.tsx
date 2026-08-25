'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useGastosStore } from '@/store/useGastoStore';
import { Gasto } from '@/services/gastoService';
import GastoCard from '@/components/GastoCard';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
import { formatMonto } from '@/lib/money';

// Delega a formatoYMD (componentes LOCALES) — d.toISOString().split('T')[0]
// corre la fecha un día para atrás en husos negativos como ART/BRT (UTC-3)
// cuando `d` no es medianoche local.
function formatFecha(d: Date): string {
  return formatoYMD(d);
}

// Mismo cálculo que estadisticas/page.tsx::rangoDelMes — no está exportado
// desde ahí (función local a ese archivo), así que se duplica acá a
// propósito en vez de forzar un import cruzado entre dos pantallas
// independientes.
function rangoDelMes(viewDate: Date): { desde: string; hasta: string } {
  const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  return { desde: formatFecha(desde), hasta: formatFecha(hasta) };
}

export default function GastosPage() {
  const router = useRouter();
  const t = useTranslations('configuracion.GastosPage');
  const { gastos, loading, error, fetchGastos, eliminarGasto } = useGastosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [viewDate, setViewDate] = useState(() => new Date());

  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rango = useMemo(() => rangoDelMes(viewDate), [viewDate]);

  // Refetch server-side (GET /gastos?desde&hasta, ver Bugfix en
  // apply-progress) cada vez que cambia el mes navegado.
  useEffect(() => {
    fetchGastos(rango);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango.desde, rango.hasta]);

  // Lookup de profesional por id — incluye inactivas/desactivadas (spec:
  // "Attribution survives Profesional status changes"), porque
  // fetchProfesionales trae la cuenta entera, no solo las activas.
  const profesionalPorId = useMemo(
    () => new Map(profesionales.map(p => [p.id, p])),
    [profesionales]
  );

  const cambiarMes = (delta: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // Suma de lo ya cargado en pantalla — conveniencia visual, no el número
  // autoritativo de ganancia neta (ese vive en Estadísticas, ver design.md).
  const totalMes = gastos.reduce((sum, g) => sum + Number(g.monto), 0);

  const handleEliminar = async (gasto: Gasto) => {
    const confirmado = await confirmDialog(
      t('deleteConfirm'),
      { confirmText: t('deleteConfirmButton'), danger: true }
    );
    if (!confirmado) return;

    const result = await eliminarGasto(gasto.id);
    if (result.success) showToast(t('deleted'));
    else await alertDialog(result.message ?? t('deleteError'));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/gastos/nuevo')}
        style={{
          position: 'fixed', bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Month navigator — mismo patrón que estadisticas/page.tsx (modo
            'mes'): flechas prev/next alrededor del nombre del mes. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 14, padding: '10px 14px',
        }}>
          <button
            onClick={() => cambiarMes(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
            {nombreMes(viewDate, 'long')} {viewDate.getFullYear()}
          </span>
          <button
            onClick={() => cambiarMes(1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Total del mes — suma client-side de lo cargado (ver nota arriba).
            Gateado por !loading && !error (mismo criterio que la lista de
            abajo): el store no pisa `gastos` si el fetch del mes falla
            (a propósito, para no "desaparecer" datos ya cargados), así que
            sin este gate la tarjeta mostraba el total del mes ANTERIOR bajo
            el mes que se está navegando ahora, contradiciendo en silencio
            el banner de error que sí aparece debajo. */}
        {!loading && !error && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14, padding: '14px 16px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.subtext }}>{t('totalLabel')}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: colors.textStrong }}>${formatMonto(totalMes)}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
          </div>
        )}

        {/* List */}
        {!loading && !error && (
          gastos.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyState')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gastos.map(g => {
                const profesional = g.profesional_id ? profesionalPorId.get(g.profesional_id) : undefined;
                return (
                  <GastoCard
                    key={g.id}
                    gasto={g}
                    profesionalLabel={profesional ? { nombre: profesional.nombre, color: profesional.color || colors.primary } : null}
                    onEdit={() => router.push(`/configuracion/gastos/${g.id}`)}
                    onDelete={() => handleEliminar(g)}
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
