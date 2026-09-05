'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { CategoriaServicio } from '@/services/categoriaServicioService';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';

export default function CategoriasPage() {
  const t = useTranslations('configuracion.CategoriasPage');
  const router = useRouter();
  const { categorias, loading, error, fetchCategorias, eliminarCategoria } = useCategoriasServicioStore();
  // Esta pantalla no cargaba servicios hasta ahora — hace falta para poder
  // contar cuántos tiene cada categoría (activos + inactivos, ver A4.2).
  const { servicios, fetchServicios } = useServiciosStore();

  useEffect(() => { fetchCategorias(); fetchServicios(); }, []);

  // Cuenta activos + inactivos (misma convención que la card de categoría en
  // el listado de Servicios — spec: el conteo incluye inactivos).
  const contarServicios = (categoriaId: number) =>
    servicios.filter(s => s.categoria_id === categoriaId).length;

  // El backend bloquea el borrado (409) si la categoría tiene servicios
  // asignados; `result.message` ya trae ese texto (extraerMensajeError lee
  // `message` del body de Laravel) — `inUseError` es solo el fallback si
  // ese body llegara vacío, mismo criterio que servicios/page.tsx.
  const handleEliminar = async (categoria: CategoriaServicio) => {
    const confirmado = await confirmDialog(
      t('deleteConfirm', { nombre: categoria.nombre }),
      { confirmText: t('deleteConfirmButton'), danger: true }
    );
    if (!confirmado) return;

    const result = await eliminarCategoria(categoria.id);
    if (result.success) showToast(t('deleted'));
    else await alertDialog(result.message ?? t('inUseError'));
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
        onClick={() => router.push('/configuracion/categorias/nuevo')}
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

        {/* List — sin orden manual (spec: alfabético, ya lo devuelve así
            GET /categorias-servicio), no hay drag-and-drop acá a propósito. */}
        {!loading && !error && (
          categorias.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {t('empty')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {categorias.map(c => {
                const count = contarServicios(c.id);
                return (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                    boxShadow: shadows.card, borderRadius: 14, padding: '14px 16px',
                  }}
                >
                  <button
                    onClick={() => router.push(`/configuracion/categorias/${c.id}`)}
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        margin: 0, fontSize: 15, fontWeight: 600, color: colors.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {c.nombre}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
                        {t('serviceCount', { count })}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleEliminar(c)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
