'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';

// `MapaPicker` es lo único que toca `window`/Leaflet (design D3) — se carga
// vía `dynamic(..., { ssr: false })` para que nunca se evalúe en SSR, y es
// el único punto que necesita `vi.mock` en tests (jsdom no puede ejercitar
// las APIs de Leaflet).
const MapaPicker = dynamic(() => import('./MapaPicker').then(m => m.MapaPicker), {
  ssr: false,
  loading: () => null,
});

interface Props {
  latitud: number | null;
  longitud: number | null;
  direccion: string;
  onCancelar: () => void;
  onConfirmar: (lat: number, lng: number) => void;
}

// Mismo z-index que LogoCropModal (design D2): modal exclusivo, nunca debajo
// de otro overlay mientras está abierto.
const Z_INDEX = 200;

export function UbicacionMapaModal({ latitud, longitud, direccion, onCancelar, onConfirmar }: Props) {
  const t = useTranslations('perfil.SheetDatosPersonales');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    latitud !== null && longitud !== null ? { lat: latitud, lng: longitud } : null,
  );

  const handleConfirmar = () => {
    if (!pin) return;
    onConfirmar(pin.lat, pin.lng);
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: Z_INDEX,
      backgroundColor: '#000', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapaPicker
          latitud={latitud}
          longitud={longitud}
          direccion={direccion}
          onPinMovido={(lat, lng) => setPin({ lat, lng })}
        />
      </div>

      <div style={{
        padding: '18px 20px calc(18px + env(safe-area-inset-bottom))',
        backgroundColor: colors.surface, boxShadow: shadows.sheet,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, textAlign: 'center' }}>
          {t('mapInstructions')}
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface, color: colors.text, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('mapCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!pin}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: 'none',
              backgroundColor: colors.primarySolid, color: '#FFF', fontSize: 14, fontWeight: 700,
              cursor: pin ? 'pointer' : 'default', opacity: pin ? 1 : 0.6,
            }}
          >
            {t('mapConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
