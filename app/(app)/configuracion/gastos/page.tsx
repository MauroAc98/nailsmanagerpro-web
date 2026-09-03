'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useGastosStore } from '@/store/useGastoStore';
import { CATEGORIAS_GASTO, Gasto } from '@/services/gastoService';
import { labelCategoriaGasto } from '@/lib/categoriaLabel';
import { useAuth } from '@/hooks/useAuth';
import GastoCard from '@/components/GastoCard';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { nombreMes, formatoYMD } from '@/lib/dateFormat';
import { formatMonto } from '@/lib/money';
import {
  filtrarGastos,
  contarFiltrosActivos,
  FILTROS_GASTO_VACIOS,
  FiltrosGasto,
} from '@/lib/filtrarGastos';

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

export default function GastosPage() {
  const router = useRouter();
  const t = useTranslations('configuracion.GastosPage');
  const { user } = useAuth();
  const { gastos, loading, error, fetchGastos, eliminarGasto } = useGastosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  // El filtro ofrece solo la lista del salón (o el set de fábrica si no
  // está cargada). No hace falta el caso de "categoría vieja ya borrada"
  // acá: si no hay chip para filtrarla, no se puede filtrar por ella, y
  // listo — a diferencia del form de edición, que sí necesita ese chip.
  const categoriasFiltro: readonly string[] = user?.categorias_gasto ?? CATEGORIAS_GASTO;

  const [viewDate, setViewDate] = useState(() => new Date());
  const [filtros, setFiltros] = useState<FiltrosGasto>(FILTROS_GASTO_VACIOS);
  const [panelAbierto, setPanelAbierto] = useState(false);

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

  // Multi-agenda — el filtro de profesional solo aparece con ≥2 activas,
  // mismo criterio que gastos/nuevo/page.tsx y agenda/nuevo/page.tsx.
  const activeProfesionales = useMemo(() => profesionales.filter(p => p.activo), [profesionales]);
  const mostrarFiltroProfesional = activeProfesionales.length > 1;

  const cambiarMes = (delta: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    // El sub-rango de fecha se define contra el mes visible — al cambiar de
    // mes queda fuera de rango, así que se limpia. Categoría/texto/
    // profesional sí sobreviven (siguen teniendo sentido en cualquier mes).
    setFiltros(f => ({ ...f, desde: null, hasta: null }));
  };

  // Filtrado client-side sobre lo que ya trajo el store para este mes — ver
  // lib/filtrarGastos.ts.
  const gastosFiltrados = useMemo(() => filtrarGastos(gastos, filtros), [gastos, filtros]);
  const filtrosActivos = contarFiltrosActivos(filtros);

  // Suma de lo que se ve en pantalla (ya filtrado) — conveniencia visual, no
  // el número autoritativo de ganancia neta (ese vive en Estadísticas, ver
  // design.md).
  const totalMostrado = gastosFiltrados.reduce((sum, g) => sum + Number(g.monto), 0);

  const limpiarFiltros = () => setFiltros(FILTROS_GASTO_VACIOS);

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

        {/* Filtros — toggle + panel colapsable. El filtrado es client-side
            sobre el mes ya cargado (lib/filtrarGastos.ts). */}
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
                      {labelCategoriaGasto(cat, t)}
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

              {/* Profesional — invisible con ≤1 profesional activa. */}
              {mostrarFiltroProfesional && (
                <div>
                  <span style={filtroLabelStyle}>{t('filterProfesionalLabel')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setFiltros(f => ({ ...f, profesionalId: null }))}
                      style={chipStyle(filtros.profesionalId === null, colors.primary)}
                    >
                      {t('filterAll')}
                    </button>
                    {activeProfesionales.map(p => {
                      const selected = filtros.profesionalId === p.id;
                      const color = p.color || colors.primary;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFiltros(f => ({ ...f, profesionalId: selected ? null : p.id }))}
                          style={chipStyle(selected, color)}
                        >
                          <span style={{
                            width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                            backgroundColor: selected ? '#FFF' : color,
                          }} />
                          {p.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
            store no pisa `gastos` si el fetch del mes falla (a propósito,
            para no "desaparecer" datos ya cargados), así que sin este gate
            la tarjeta mostraba el total del mes ANTERIOR bajo el mes que se
            está navegando ahora, contradiciendo en silencio el banner de
            error que sí aparece debajo. */}
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
          gastos.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyState')}
            </p>
          ) : gastosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('emptyFiltered')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gastosFiltrados.map(g => {
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
