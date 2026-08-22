'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { colors, shadows } from '@/theme/colors';
import { useServiciosStore } from '@/store/useServicioStore';
import DuracionPicker from '@/components/DuracionPicker';
import { alertDialog } from '@/store/useConfirmStore';
import PillToggle from '@/components/PillToggle';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  boxShadow: shadows.card, borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: colors.text, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: colors.textStrong,
  marginBottom: 7, display: 'block', marginLeft: 2,
};

export default function NuevoServicioPage() {
  const t = useTranslations('configuracion.NuevoServicioPage');
  const router = useRouter();
  const { servicios, agregarServicio } = useServiciosStore();

  const [nombre,  setNombre]  = useState('');
  const [duracion, setDuracion] = useState(30);
  const [precio,  setPrecio]  = useState('');
  const [esPromo, setEsPromo] = useState(false);
  const [errorNombre, setErrorNombre] = useState('');
  const [saving,  setSaving]  = useState(false);

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }
    if (duracion <= 0) {
      await alertDialog(t('invalidDuration'));
      return;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    const existente = servicios.find(s => s.nombre.toLowerCase() === nombreNormalizado);
    if (existente) {
      const msg = existente.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      return;
    }

    setSaving(true);
    const result = await agregarServicio({
      nombre: nombre.trim(),
      duracion_minutos: duracion,
      precio: precio ? parseFloat(precio) : undefined,
      es_promo: esPromo,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/servicios');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Form */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Nombre */}
        <div>
          <label style={labelStyle}>{t('nameLabel')}</label>
          <input
            type="text"
            placeholder={t('namePlaceholder')}
            value={nombre}
            onChange={e => { setNombre(e.target.value); setErrorNombre(''); }}
            style={{ ...inputStyle, borderColor: errorNombre ? colors.dangerBorder : colors.border }}
          />
          {errorNombre && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errorNombre}</p>}
        </div>

        {/* Duración */}
        <div>
          <label style={labelStyle}>{t('durationLabel')}</label>
          <DuracionPicker value={duracion} onChange={setDuracion} />
        </div>

        {/* Precio */}
        <div>
          <label style={labelStyle}>{t('priceLabel')}</label>
          <input
            type="number"
            placeholder={t('pricePlaceholder')}
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            style={inputStyle}
            inputMode="decimal"
          />
        </div>

        {/* Promo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 16px',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('promoLabel')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {t('promoHint')}
            </p>
          </div>
          <PillToggle value={esPromo} onChange={setEsPromo} />
        </div>

        {/* Button */}
        <button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: saving ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  );
}
