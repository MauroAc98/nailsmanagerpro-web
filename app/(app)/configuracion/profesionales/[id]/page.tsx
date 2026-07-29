'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import { profesionalPalette } from '@/theme/colors';
import { alertDialog } from '@/store/useConfirmStore';

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

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
      border: `2px solid ${checked ? colors.primary : colors.divider}`,
      backgroundColor: checked ? colors.primary : colors.surface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

function PillToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? withAlpha(colors.primary, '66') : colors.border,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: value ? colors.primary : colors.placeholder,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

export default function EditarProfesionalPage() {
  const t = useTranslations('configuracion.EditarProfesionalPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { profesionales, fetchProfesionales, actualizarProfesional } = useProfesionalStore();
  const { servicios, fetchServicios } = useServiciosStore();

  const [nombre,      setNombre]      = useState('');
  const [color,       setColor]       = useState<string>(profesionalPalette[0]);
  const [activo,      setActivo]      = useState(true);
  const [servicioIds, setServicioIds] = useState<number[]>([]);
  const [errorNombre, setErrorNombre] = useState('');
  const [loadingProfesional, setLoadingProfesional] = useState(true);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    const cargar = async () => {
      if (servicios.length === 0) fetchServicios();

      let p = profesionales.find(x => x.id === id);
      if (!p) {
        await fetchProfesionales();
      }
      p = useProfesionalStore.getState().profesionales.find(x => x.id === id);

      if (!p) {
        await alertDialog(t('loadError'));
        router.push('/configuracion/profesionales');
        return;
      }

      setNombre(p.nombre);
      setColor(p.color || profesionalPalette[0]);
      setActivo(p.activo);
      setServicioIds(p.servicios.map(s => s.id));
      setLoadingProfesional(false);
    };
    if (id) cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleServicio = (sid: number) => {
    setServicioIds(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }

    const nombreNormalizado = nombre.trim().toLowerCase();
    const duplicado = profesionales.find(p => p.nombre.toLowerCase() === nombreNormalizado && p.id !== id);
    if (duplicado) {
      const msg = duplicado.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      return;
    }

    setSaving(true);
    const result = await actualizarProfesional(id, {
      nombre: nombre.trim(),
      color,
      activo,
      servicio_ids: servicioIds,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/profesionales');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  const serviciosActivos = servicios.filter(s => s.activo);

  if (loadingProfesional) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtext }}>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSubtle,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textStrong} strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
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

        {/* Color */}
        <div>
          <label style={labelStyle}>{t('colorLabel')}</label>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>

        {/* Activo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 16px',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text }}>{t('activeLabel')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {activo ? t('activeSubtitleOn') : t('activeSubtitleOff')}
            </p>
          </div>
          <PillToggle value={activo} onChange={setActivo} />
        </div>

        {/* Servicios */}
        <div>
          <label style={labelStyle}>{t('servicesLabel')}</label>
          {serviciosActivos.length === 0 ? (
            <p style={{ fontSize: 13, color: colors.subtext, margin: '4px 0 0 2px' }}>
              {t('noActiveServices')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {serviciosActivos.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggleServicio(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <Checkbox checked={servicioIds.includes(s.id)} />
                  <span style={{ flex: 1, fontSize: 14, color: colors.text }}>{s.nombre}</span>
                  <span style={{ fontSize: 12, color: colors.subtext }}>{s.duracion_minutos} min</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Button */}
        <button
          onClick={handleGuardar}
          disabled={saving}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: saving ? colors.primaryDisabled : colors.primary,
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
