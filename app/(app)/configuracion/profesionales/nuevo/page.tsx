'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import { profesionalPalette } from '@/theme/colors';
import { alertDialog } from '@/store/useConfirmStore';
import { SelectorServiciosPorCategoria } from '@/components/configuracion/SelectorServiciosPorCategoria';

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

export default function NuevoProfesionalPage() {
  const t = useTranslations('configuracion.NuevoProfesionalPage');
  const router = useRouter();
  const { profesionales, agregarProfesional } = useProfesionalStore();
  const { servicios, fetchServicios } = useServiciosStore();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [color, setColor] = useState<string>(profesionalPalette[0]);
  const [servicioIds, setServicioIds] = useState<number[]>([]);
  const [errorNombre, setErrorNombre] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (servicios.length === 0) fetchServicios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }

    // Nombre completo (no solo 'nombre') para no confundir a dos
    // profesionales con el mismo nombre de pila y apellido distinto — ver
    // Profesional::nombreCompleto en el backend, mismo criterio acá.
    const nombreCompletoNormalizado = `${nombre.trim()} ${apellido.trim()}`.trim().toLowerCase();
    const existente = profesionales.find(p => p.nombre_completo.toLowerCase() === nombreCompletoNormalizado);
    if (existente) {
      const msg = existente.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      return;
    }

    setSaving(true);
    const result = await agregarProfesional({
      nombre: nombre.trim(),
      apellido: apellido.trim() || undefined,
      color,
      servicio_ids: servicioIds,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/profesionales');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 40 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 16px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
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

        {/* Apellido */}
        <div>
          <label style={labelStyle}>{t('lastNameLabel')}</label>
          <input
            type="text"
            placeholder={t('lastNamePlaceholder')}
            value={apellido}
            onChange={e => setApellido(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Color */}
        <div>
          <label style={labelStyle}>{t('colorLabel')}</label>
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>

        {/* Servicios */}
        <div>
          <label style={labelStyle}>{t('servicesLabel')}</label>
          <SelectorServiciosPorCategoria
            servicios={servicios}
            servicioIds={servicioIds}
            onChange={setServicioIds}
          />
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
