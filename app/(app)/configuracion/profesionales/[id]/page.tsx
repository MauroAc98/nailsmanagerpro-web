'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useServiciosStore } from '@/store/useServicioStore';
import ColorSwatchPicker from '@/components/ColorSwatchPicker';
import { profesionalPalette } from '@/theme/colors';
import { alertDialog } from '@/store/useConfirmStore';
import PillToggle from '@/components/PillToggle';
import { SelectorServicios } from '@/components/SelectorServicios';

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

export default function EditarProfesionalPage() {
  const t = useTranslations('configuracion.EditarProfesionalPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { profesionales, fetchProfesionales, actualizarProfesional } = useProfesionalStore();
  const { servicios, fetchServicios } = useServiciosStore();

  const [nombre,      setNombre]      = useState('');
  const [apellido,    setApellido]    = useState('');
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
      setApellido(p.apellido ?? '');
      setColor(p.color || profesionalPalette[0]);
      setActivo(p.activo);
      // `p.servicios` viene de `->with('servicios')` en el backend, sin
      // filtrar por `activo` (ver Profesional::servicios / ProfesionalController@index) —
      // incluye servicios inactivos ya asignados. Semillar acá con TODOS
      // los ids (no solo los activos) es lo que le permite a
      // `SelectorServicios` preservarlos aunque no los muestre: el
      // componente filtra a activos solo para renderizar, pero cualquier id
      // fuera de ese subconjunto pasa intacto por sus mutaciones (ver su
      // prop `selectedIds`).
      setServicioIds(p.servicios.map(s => s.id));
      setLoadingProfesional(false);
    };
    if (id) cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }

    // Nombre completo (no solo 'nombre') — mismo criterio que la pantalla
    // de alta, ver Profesional::nombreCompleto en el backend.
    const nombreCompletoNormalizado = `${nombre.trim()} ${apellido.trim()}`.trim().toLowerCase();
    const duplicado = profesionales.find(p => p.nombre_completo.toLowerCase() === nombreCompletoNormalizado && p.id !== id);
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
      apellido: apellido.trim() || null,
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

  if (loadingProfesional) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtext }}>{t('loading')}</p>
      </div>
    );
  }

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
          <SelectorServicios
            servicios={servicios}
            mode="multi"
            selectedIds={servicioIds}
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
