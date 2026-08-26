'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useServiciosStore } from '@/store/useServicioStore';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';
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

// Mismo patrón que el chip de categoría en gastos/nuevo/page.tsx (color
// fijo, sin punto de color por-item como el selector de profesional —
// las categorías de servicio no tienen color propio).
function chipStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
    border: `1px solid ${selected ? colors.primarySolid : colors.divider}`,
    backgroundColor: selected ? colors.primarySolid : colors.surface,
    color: selected ? '#FFF' : colors.text,
  };
}

export default function NuevoServicioPage() {
  const t = useTranslations('configuracion.NuevoServicioPage');
  const router = useRouter();
  const { servicios, agregarServicio } = useServiciosStore();
  const { categorias, fetchCategorias, loading: categoriasLoading, error: categoriasError } = useCategoriasServicioStore();

  const [nombre,  setNombre]  = useState('');
  const [duracion, setDuracion] = useState(30);
  const [precio,  setPrecio]  = useState('');
  const [esPromo, setEsPromo] = useState(false);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [errorNombre, setErrorNombre] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (categorias.length === 0) fetchCategorias();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeleccionarCategoria = (id: number) => {
    setCategoriaId(prev => prev === id ? null : id);
  };

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
      categoria_id: categoriaId,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/servicios');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  return (
    // AgendaThemeScope vive en app/(app)/configuracion/servicios/layout.tsx
    // (segmento completo migrado — listado + nuevo + [id]), no acá.
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

        {/* Categoría — opcional, invisible sin categorías cargadas (spec:
            no forzar al usuario a crear una para poder seguir usando
            servicios como antes). Tap en la misma chip deselecciona → null,
            mismo patrón que el selector de profesional en gastos/nuevo. */}
        {categorias.length > 0 && (
          <div>
            <label style={labelStyle}>{t('categoryLabel')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {/* "Sin categoría" explícito — más claro que depender solo de
                  tap-en-la-misma-chip para deseleccionar, sobre todo al
                  editar un servicio que ya tiene una categoría asignada. */}
              <button
                type="button"
                onClick={() => setCategoriaId(null)}
                style={chipStyle(categoriaId === null)}
              >
                {t('categoryNone')}
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSeleccionarCategoria(cat.id)}
                  style={chipStyle(categoriaId === cat.id)}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Sin esto, un fetch de categorías fallido es indistinguible de
            "esta cuenta no tiene categorías" — el selector simplemente no
            aparece y no queda ninguna señal de que algo rompió. */}
        {categoriasError && categorias.length === 0 && (
          <p style={{ margin: 0, fontSize: 12, color: colors.subtext }}>{t('categoriesLoadError')}</p>
        )}

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
        {/* categoriasLoading también deshabilita: fetchCategorias() y
            agregarServicio() comparten el mismo withGlobalLoader booleano
            (no contador, ver comentario en useServicioStore.ts) — si el
            submit dispara mientras la categoría todavía está en vuelo, el
            finally que termine primero apaga el spinner con la otra
            operación todavía en curso. Bloquear el submit hasta que
            categorías resuelva evita el solape en vez de intentar arreglar
            el contador compartido. */}
        <button
          onClick={handleGuardar}
          disabled={saving || categoriasLoading}
          style={{
            marginTop: 20, height: 52, borderRadius: 14,
            backgroundColor: (saving || categoriasLoading) ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: (saving || categoriasLoading) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  );
}
