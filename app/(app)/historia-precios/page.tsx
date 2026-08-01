'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { useHistoriaPrecios } from '@/hooks/useHistoriaPrecios';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { HistoriaPreciosCanvas, BASE_WIDTH, BASE_HEIGHT } from '@/components/historia-precios/HistoriaPreciosCanvas';
import { SelectorPlantilla } from '@/components/historia-precios/SelectorPlantilla';
import { GestorFotos } from '@/components/historia-precios/GestorFotos';

// ─────────────────────────────────────────────
// Responsive preview wrapper — HistoriaPreciosCanvas ALWAYS renders at its
// intrinsic BASE_WIDTH/BASE_HEIGHT (design D3: no `scale`/`mode` prop, one
// code path for preview and export). On a narrow viewport that fixed size
// wouldn't fit on screen, so this wraps it in the same CSS `transform:
// scale()` trick MiniaturaCanvas uses for the picker thumbnails — the
// difference is this wrapper forwards `canvasRef` straight through to the
// INNER unscaled node (MiniaturaCanvas deliberately does not: "thumbnails
// are never the capture target"). The transform never touches the captured
// DOM, so this stays byte-identical to the export, same guarantee D3
// documents for the picker.
// ─────────────────────────────────────────────
function useCanvasScale() {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(Math.min(BASE_WIDTH, window.innerWidth * 0.85));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const scale = width ? width / BASE_WIDTH : 1;
  return { width, height: BASE_HEIGHT * scale, scale };
}

export default function HistoriaPreciosPage() {
  const t      = useTranslations('historia.HistoriaPreciosPage');
  const router = useRouter();

  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { servicios, fetchServicios }         = useServiciosStore();
  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
    if (servicios.length === 0) fetchServicios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    effectiveProfesionalId, serviciosActivos,
    layoutId, estiloId, handleLayoutChange, handleEstiloChange,
    fotos, fotosUrls, puedeCapturar,
    canvasRef, descargarImagen, compartirImagen,
  } = useHistoriaPrecios();

  const { width: canvasWidth, height: canvasHeight, scale } = useCanvasScale();

  const cargando = profesionales.length === 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.surface, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {cargando ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      ) : !effectiveProfesionalId ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('noProfessional')}</p>
        </div>
      ) : (
        <div style={{
          paddingTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: canvasWidth || '100%', margin: '0 auto',
        }}>
          {/* Canvas preview — same node the capture targets, see useCanvasScale above */}
          <div style={{ width: canvasWidth, height: canvasHeight, overflow: 'hidden', borderRadius: 16 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <HistoriaPreciosCanvas
                ref={canvasRef}
                layoutId={layoutId}
                estiloId={estiloId}
                fotos={fotosUrls}
                servicios={serviciosActivos}
              />
            </div>
          </div>

          {/* Plantilla picker */}
          <div style={{ width: '100%', marginTop: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 10px' }}>
              {t('templateSectionTitle')}
            </p>
            <SelectorPlantilla
              fotos={fotosUrls}
              servicios={serviciosActivos}
              layoutId={layoutId}
              estiloId={estiloId}
              onLayoutChange={handleLayoutChange}
              onEstiloChange={handleEstiloChange}
            />
          </div>

          {/* Gestor de fotos */}
          <div style={{
            width: '100%', marginTop: 25, paddingTop: 20,
            borderTop: `1px solid ${colors.divider}`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.textStrong, margin: '0 0 4px' }}>
              {t('photosSectionTitle')}
            </p>
            <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 10px' }}>
              {t('photosSectionHint')}
            </p>
            <GestorFotos profesionalId={effectiveProfesionalId} fotos={fotos} />
          </div>

          {!puedeCapturar && (
            <p style={{ fontSize: 12, color: colors.subtext, textAlign: 'center', margin: '16px 0 0' }}>
              {t('emptyPhotosState')}
            </p>
          )}

          {/* Footer actions */}
          <div style={{ width: '100%', marginTop: 25, display: 'flex', gap: 10 }}>
            <button
              onClick={descargarImagen}
              disabled={!puedeCapturar}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 0', borderRadius: 14, background: colors.surface, border: `1.5px solid ${colors.border}`,
                cursor: puedeCapturar ? 'pointer' : 'not-allowed', opacity: puedeCapturar ? 1 : 0.5,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>{t('save')}</span>
            </button>
            <button
              onClick={compartirImagen}
              disabled={!puedeCapturar}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 0', borderRadius: 14, background: colors.surface, border: `1.5px solid ${colors.border}`,
                cursor: puedeCapturar ? 'pointer' : 'not-allowed', opacity: puedeCapturar ? 1 : 0.5,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary }}>{t('share')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
