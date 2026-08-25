'use client';

import { useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useTranslations } from 'next-intl';
import { agendaColors as colors, agendaShadows as shadows } from '@/theme/agendaColors';
import { LOGO_ASPECT_RATIO, recortarLogo } from '@/lib/logo';

interface Props {
  archivo: File;
  onCancelar: () => void;
  onConfirmar: (archivoRecortado: File) => void;
}

// Encima de todo lo demás en la app (ConfirmSheetHost/ToastHost llegan a
// 100) — es un modal exclusivo disparado por una acción explícita del
// usuario (elegir un logo), no debería quedar nunca por debajo de otro
// overlay mientras está abierto.
const Z_INDEX = 200;

export function LogoCropModal({ archivo, onCancelar, onConfirmar }: Props) {
  const t = useTranslations('perfil.HeroPerfil');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixeles, setAreaPixeles] = useState<Area | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Crear Y revocar la URL en el mismo efecto (no un useState inicial +
  // cleanup separado) — con eso separado, React Strict Mode en dev monta,
  // desmonta y remonta este efecto una vez de más: el cleanup del primer
  // montaje revocaba la URL antes de que <Cropper> llegara a cargarla,
  // dejando el área de recorte en negro (bug real, visto en vivo — la
  // imagen quedaba con naturalWidth/Height en 0 pese a `complete: true`).
  // Acá cada corrida crea su propia URL y solo revoca ESA, así el segundo
  // montaje de Strict Mode arranca de cero con una URL válida.
  useEffect(() => {
    const url = URL.createObjectURL(archivo);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  const handleConfirmar = async () => {
    if (!imageSrc || !areaPixeles || procesando) return;
    setProcesando(true);
    try {
      const archivoRecortado = await recortarLogo(imageSrc, areaPixeles);
      onConfirmar(archivoRecortado);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: Z_INDEX,
      backgroundColor: '#000', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={LOGO_ASPECT_RATIO}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setAreaPixeles(pixels)}
          />
        )}
      </div>

      <div style={{
        padding: '18px 20px calc(18px + env(safe-area-inset-bottom))',
        backgroundColor: colors.surface, boxShadow: shadows.sheet,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, textAlign: 'center' }}>
          {t('cropInstructions')}
        </p>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ width: '100%', accentColor: colors.primaryDeep }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface, color: colors.text, fontSize: 14, fontWeight: 600,
              cursor: procesando ? 'default' : 'pointer',
            }}
          >
            {t('cropCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={procesando || !areaPixeles}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: 'none',
              backgroundColor: colors.primarySolid, color: '#FFF', fontSize: 14, fontWeight: 700,
              cursor: procesando ? 'default' : 'pointer', opacity: procesando ? 0.7 : 1,
            }}
          >
            {procesando ? t('cropSaving') : t('cropConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
