'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
import { categoriaServicioService } from '@/services/categoriaServicioService';
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

export default function EditarCategoriaPage() {
  const t = useTranslations('configuracion.EditarCategoriaPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { categorias, actualizarCategoria } = useCategoriasServicioStore();

  const [nombre, setNombre] = useState('');
  const [errorNombre, setErrorNombre] = useState('');
  const [loadingCategoria, setLoadingCategoria] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const fromStore = categorias.find(c => c.id === id);
        const c = fromStore ?? await categoriaServicioService.getOne(id);
        setNombre(c.nombre);
      } catch {
        await alertDialog(t('loadError'));
        router.push('/configuracion/categorias');
      } finally {
        setLoadingCategoria(false);
      }
    };
    if (id) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      setErrorNombre(t('nameRequired'));
      return;
    }

    // Mismo pre-check que NuevaCategoriaPage — no es autoritativo (ver
    // comentario ahí), solo excluye la propia categoría que se está editando.
    const nombreNormalizado = nombre.trim().toLowerCase();
    const duplicado = categorias.find(c => c.nombre.toLowerCase() === nombreNormalizado && c.id !== id);
    if (duplicado) {
      await alertDialog(t('duplicate'));
      return;
    }

    setSaving(true);
    const result = await actualizarCategoria(id, { nombre: nombre.trim() });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/categorias');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  if (loadingCategoria) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtext }}>{t('loading')}</p>
      </div>
    );
  }

  return (
    // AgendaThemeScope vive en app/(app)/configuracion/categorias/layout.tsx
    // (segmento completo — listado + nuevo + [id]), no acá.
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
