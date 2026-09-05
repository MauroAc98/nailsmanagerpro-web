'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { useIngresosStore } from '@/store/useIngresoStore';
import { CATEGORIAS_INGRESO, Ingreso } from '@/services/ingresoService';
import { labelCategoriaIngreso } from '@/lib/categoriaLabel';
import { useAuth } from '@/hooks/useAuth';
import IngresoCard from '@/components/IngresoCard';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
import { formatMonto } from '@/lib/money';
import {
  filtrarIngresos,
  contarFiltrosActivos,
  FILTROS_INGRESO_VACIOS,
  FiltrosIngreso,
} from '@/lib/filtrarIngresos';

// Delega a formatoYMD (componentes LOCALES) — d.toISOString().split('T')[0]
// corre la fecha un día para atrás en husos negativos como ART/BRT (UTC-3)
// cuando `d` no es medianoche local.
function formatFecha(d: Date): string {
  return formatoYMD(d);
}

// Mismo cálculo que estadisticas/page.tsx::rangoDelMes y gastos/page.tsx —
// función local a cada pantalla independiente, se duplica a propósito en
// vez de forzar un import cruzado.
function rangoDelMes(viewDate: Date): { desde: string; hasta: string } {
  const desde = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const hasta = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  return { desde: formatFecha(desde), hasta: formatFecha(hasta) };
}

function chipStyle(selected: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    borderRadius: 20, padding: '7px 14px', fontSize: 13, cursor: 'pointer',
    border: `1px solid ${selected ? color : colors.divider}`,
    backgroundColor: selected ? color : colors.surface,
    color: selected ? '#FFF' : colors.text,
  };
}

const filtroLabelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: colors.muted, letterSpacing: 0.5,
  textTransform: 'uppercase', marginBottom: 8, display: 'block',
};

const dateInputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  borderRadius: 10, padding: '10px 12px', fontSize: 14, color: colors.text, outline: 'none',
};

export default function IngresosPage() {
  const router = useRouter();
  const t = useTranslations('configuracion.IngresosPage');
  const { user } = useAuth();
  const { ingresos, loading, error, fetchIngresos, eliminarIngreso } = useIngresosStore();

  // El filtro ofrece solo la lista del salón (o el set de fábrica si no
  // está cargada). No hace falta el caso de "categoría vieja ya borrada"
  // acá, a diferencia del form de edición.
  const categoriasFiltro: readonly string[] = user?.categorias_ingreso ?? CATEGORIAS_INGRESO;

  const [viewDate, setViewDate] = useState(() => new Date());
  const [filtros, setFiltros] = useState<FiltrosIngreso>(FILTROS_INGRESO_VACIOS);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const rango = useMemo(() => rangoDelMes(viewDate), [viewDate]);

  // Refetch server-side (GET /ingresos?desde&hasta) cada vez que cambia el
  // mes navegado.
  useEffect(() => {
    fetchIngresos(rango);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango.desde, rango.hasta]);

  const cambiarMes = (delta: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    // El sub-rango de fecha se define contra el mes visible — al cambiar de
    // mes queda fuera de rango, así que se limpia. Categoría/texto sí
    // sobreviven (siguen teniendo sentido en cualquier mes).
    setFiltros(f => ({ ...f, desde: null, hasta: null }));
  };

  // Filtrado client-side sobre lo que ya trajo el store para este mes — ver
  // lib/filtrarIngresos.ts.
  const ingresosFiltrados = useMemo(() => filtrarIngresos(ingresos, filtros), [ingresos, filtros]);
  const filtrosActivos = contarFiltrosActivos(filtros);

  // Suma de lo que se ve en pantalla (ya filtrado) — conveniencia visual, no
  // el número autoritativo de ganancia neta (ese vive en Estadísticas).
  const totalMostrado = ingresosFiltrados.reduce((sum, i) => sum + Number(i.monto), 0);

  const limpiarFiltros = () => setFiltros(FILTROS_INGRESO_VACIOS);

  const handleEliminar = async (ingreso: Ingreso) => {
    const confirmado = await confirmDialog(
      t('deleteConfirm'),
      { confirmText: t('deleteConfirmButton'), danger: true }
    );
    if (!confirmado) return;

    const result = await eliminarIngreso(ingreso.id);
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

      {/* Entry point: Gestionar categorías (mismo patrón que
          servicios/page.tsx — único punto de entrada sancionado al editor
          de categorías de gastos/ingresos, ahora que se sacó del menú raíz
          de Configuración). Categorías de movimientos es una pantalla
          compartida con Gastos, así que ambas listas necesitan su propio
          entry point acá. */}
      <div style={{ padding: '0 20px 16px' }}>
        <button
          onClick={() => router.push('/configuracion/categorias-movimientos?tab=ingreso')}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14,
            padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 36, height: 36, backgroundColor: withAlpha(colors.primary, '15'),
            borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.primaryDeep} strokeWidth="2">
              <rect x="3" y="4" width="7" height="7" rx="1.5" />
              <rect x="14" y="4" width="7" height="7" rx="1.5" />
              <rect x="3" y="13" width="7" height="7" rx="1.5" />
              <rect x="14" y="13" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text }}>
              {t('manageCategoriesButton')}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {t('manageCategoriesHint')}
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2" style={{ flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/ingresos/nuevo')}
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

        {/* Filtros — toggle + panel colapsable. El filtrado es client-side
            sobre el mes ya cargado (lib/filtrarIngresos.ts). Sin dimensión
            de profesional: un ingreso no tiene profesional_id. */}
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPanelAbierto(v => !v)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: colors.surface, border: `1px solid ${filtrosActivos > 0 ? colors.primarySolid : colors.border}`,
                boxShadow: shadows.card, borderRadius: 12, padding: '10px 14px',
                fontSize: 14, fontWeight: 600, color: colors.text, cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {t('filtersToggle')}
              {filtrosActivos > 0 && (
                <span style={{
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                  backgroundColor: colors.primarySolid, color: '#FFF',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {filtrosActivos}
                </span>
              )}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2"
                style={{ transform: panelAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {filtrosActivos > 0 && (
              <button
                onClick={limpiarFiltros}
                style={{
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card, borderRadius: 12, padding: '10px 14px',
                  fontSize: 14, fontWeight: 600, color: colors.primaryDeep, cursor: 'pointer',
                }}
              >
                {t('filtersClear')}
              </button>
            )}
          </div>

          {panelAbierto && (
            <div style={{
              marginTop: 10, backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
              boxShadow: shadows.card, borderRadius: 14, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              {/* Categoría */}
              <div>
                <span style={filtroLabelStyle}>{t('filterCategoryLabel')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFiltros(f => ({ ...f, categoria: null }))}
                    style={chipStyle(filtros.categoria === null, colors.primarySolid)}
                  >
                    {t('filterAll')}
                  </button>
                  {categoriasFiltro.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFiltros(f => ({ ...f, categoria: f.categoria === cat ? null : cat }))}
                      style={chipStyle(filtros.categoria === cat, colors.primarySolid)}
                    >
                      {labelCategoriaIngreso(cat, t)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <span style={filtroLabelStyle}>{t('filterTextLabel')}</span>
                <input
                  type="text"
                  value={filtros.texto}
                  onChange={e => setFiltros(f => ({ ...f, texto: e.target.value }))}
                  placeholder={t('filterTextPlaceholder')}
                  style={dateInputStyle}
                />
              </div>

              {/* Fecha — sub-rango dentro del mes visible. Los inputs quedan
                  acotados a `rango` (min/max) para que no se elija un día
                  fuera del mes que está cargado en pantalla. */}
              <div>
                <span style={filtroLabelStyle}>{t('filterDateLabel')}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: colors.subtext, marginBottom: 4, display: 'block' }}>{t('filterDateFrom')}</span>
                    <input
                      type="date"
                      min={rango.desde}
                      max={filtros.hasta ?? rango.hasta}
                      value={filtros.desde ?? ''}
                      onChange={e => setFiltros(f => ({ ...f, desde: e.target.value || null }))}
                      style={dateInputStyle}
                    />
                  </label>
                  <label style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: colors.subtext, marginBottom: 4, display: 'block' }}>{t('filterDateTo')}</span>
                    <input
                      type="date"
                      min={filtros.desde ?? rango.desde}
                      max={rango.hasta}
                      value={filtros.hasta ?? ''}
                      onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value || null }))}
                      style={dateInputStyle}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Total — suma client-side de lo que se ve (ya filtrado). Gateado
            por !loading && !error (mismo criterio que la lista de abajo): el
            store no pisa `ingresos` si el fetch del mes falla (a propósito,
            para no "desaparecer" datos ya cargados). */}
        {!loading && !error && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            boxShadow: shadows.card, borderRadius: 14, padding: '14px 16px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.subtext }}>
              {filtrosActivos > 0 ? t('totalFilteredLabel') : t('totalLabel')}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: colors.textStrong }}>${formatMonto(totalMostrado)}</span>
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
          ingresos.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyState')}
            </p>
          ) : ingresosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyFiltered')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ingresosFiltrados.map(i => (
                <IngresoCard
                  key={i.id}
                  ingreso={i}
                  onEdit={() => router.push(`/configuracion/ingresos/${i.id}`)}
                  onDelete={() => handleEliminar(i)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
