'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutId, EstiloId } from '@/services/profesionalService';
import { Servicio } from '@/services/servicioService';
import { colors, withAlpha } from '@/theme/colors';
import { showToast } from '@/store/useToastStore';
import { LAYOUTS, ESTILOS } from './catalogo';
import { MiniaturaCanvas } from './MiniaturaCanvas';

const THUMB_WIDTH = 100;

interface Props {
  // Memoized `data:` photo URLs, already resolved upstream (see
  // useHistoriaPrecios, Phase 5) — reused by reference across all 9
  // thumbnails so each photo is fetched once total, not once per
  // combination. SelectorPlantilla never fetches or mutates this array.
  fotos:          string[];
  // Already-filtered active `Servicio` list, same as what TarjetaPrecios
  // expects — this component is purely presentational, no store access.
  servicios:      Servicio[];
  layoutId:       LayoutId;
  estiloId:       EstiloId;
  onLayoutChange: (id: LayoutId) => void;
  onEstiloChange: (id: EstiloId) => void;
}

// SelectorPlantilla — 3x3 picker (layout x estilo = 9 combinations, spec:
// price-story-templates). Every thumbnail renders through the SAME
// HistoriaPreciosCanvas/MiniaturaCanvas the final export captures (see D3),
// previewed with the caller's real photos and real service prices — never
// placeholder content (spec: "Picker previews with real data").
export function SelectorPlantilla({
  fotos, servicios, layoutId, estiloId, onLayoutChange, onEstiloChange,
}: Props) {
  const t = useTranslations('historia.SelectorPlantilla');
  const combinaciones = useMemo(
    () => LAYOUTS.flatMap(layout => ESTILOS.map(estilo => ({ layout, estilo }))),
    []
  );

  // Reactive fallback (task 3.8) — if a photo is later deleted (Phase 4's
  // GestorFotos, not built here) and the CURRENTLY selected layout's
  // minFotos no longer fits the live `fotos` prop, fall back to 'single'
  // (minFotos: 1, never locked once at least 1 photo exists) and tell the
  // user why. This effect only self-corrects whatever `fotos` it's given —
  // it does not own or render any deletion UI itself.
  useEffect(() => {
    const layoutActual = LAYOUTS.find(l => l.id === layoutId);
    if (!layoutActual) return;
    if (fotos.length < layoutActual.minFotos && layoutId !== 'single') {
      onLayoutChange('single');
      showToast(t('fallbackToast'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.length, layoutId, onLayoutChange]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {combinaciones.map(({ layout, estilo }) => {
        const bloqueado    = fotos.length < layout.minFotos;
        const seleccionado = layoutId === layout.id && estiloId === estilo.id;
        const faltan       = layout.minFotos - fotos.length;

        return (
          <button
            key={`${layout.id}-${estilo.id}`}
            type="button"
            disabled={bloqueado}
            onClick={() => {
              onLayoutChange(layout.id);
              onEstiloChange(estilo.id);
            }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: 4, borderRadius: 14, cursor: bloqueado ? 'not-allowed' : 'pointer',
              background: seleccionado ? withAlpha(colors.primary, '1F') : 'transparent',
              border: `1.5px solid ${seleccionado ? colors.primary : colors.border}`,
              opacity: bloqueado ? 0.45 : 1,
            }}
          >
            <MiniaturaCanvas
              layoutId={layout.id}
              estiloId={estilo.id}
              fotos={fotos}
              servicios={servicios}
              width={THUMB_WIDTH}
            />
            {bloqueado && (
              <span style={{ fontSize: 9, fontWeight: 600, color: colors.subtext, textAlign: 'center' }}>
                {t('missingPhotos', { count: faltan })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
