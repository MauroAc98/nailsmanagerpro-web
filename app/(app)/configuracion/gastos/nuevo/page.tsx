'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { useGastosStore } from '@/store/useGastoStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { CATEGORIAS_GASTO, CategoriaGasto } from '@/services/gastoService';
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

function chipStyle(selected: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
    border: `1px solid ${selected ? color : colors.divider}`,
    backgroundColor: selected ? color : colors.surface,
    color: selected ? '#FFF' : colors.text,
  };
}

function fechaHoy(): string {
  return new Date().toISOString().split('T')[0];
}

export default function NuevoGastoPage() {
  const t    = useTranslations('configuracion.NuevoGastoPage');
  // Las labels de categoría (`category_insumos`, etc.) ya existen en
  // configuracion.GastosPage desde la pantalla de listado — se reusan acá
  // en vez de duplicarlas bajo NuevoGastoPage.
  const tCat = useTranslations('configuracion.GastosPage');
  const router = useRouter();
  const { agregarGasto } = useGastosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [fecha, setFecha] = useState(fechaHoy());
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [errorMonto, setErrorMonto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Multi-agenda — invisible con ≤1 profesional activa, mismo criterio que
  // agenda/nuevo/page.tsx.
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;

  const handleSeleccionarProfesional = (id: number) => {
    setSelectedProfesionalId(prev => prev === id ? null : id);
  };

  const handleGuardar = async () => {
    if (!fecha) {
      await alertDialog(t('dateRequired'));
      return;
    }
    const montoNumerico = parseFloat(monto);
    if (!monto || isNaN(montoNumerico) || montoNumerico <= 0) {
      setErrorMonto(t('invalidAmount'));
      return;
    }
    if (!categoria) {
      await alertDialog(t('categoryRequired'));
      return;
    }

    setSaving(true);
    const result = await agregarGasto({
      fecha,
      monto: montoNumerico,
      categoria,
      descripcion: descripcion.trim() ? descripcion.trim() : undefined,
      ...(mostrarSelectorProfesional && selectedProfesionalId
        ? { profesional_id: selectedProfesionalId }
        : {}),
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/gastos');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

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
        {/* Fecha */}
        <div>
          <label style={labelStyle}>{t('dateLabel')}</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Monto */}
        <div>
          <label style={labelStyle}>{t('amountLabel')}</label>
          <input
            type="number"
            placeholder={t('amountPlaceholder')}
            value={monto}
            onChange={e => { setMonto(e.target.value); setErrorMonto(''); }}
            style={{ ...inputStyle, borderColor: errorMonto ? colors.dangerBorder : colors.border }}
            inputMode="decimal"
          />
          {errorMonto && <p style={{ margin: '4px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{errorMonto}</p>}
        </div>

        {/* Categoría — set fijo de 5 opciones (CATEGORIAS_GASTO), nunca
            texto libre. Ver design.md decisión #1. */}
        <div>
          <label style={labelStyle}>{t('categoryLabel')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIAS_GASTO.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                style={chipStyle(categoria === cat, colors.primary)}
              >
                {tCat(`category_${cat}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label style={labelStyle}>{t('descriptionLabel')}</label>
          <input
            type="text"
            placeholder={t('descriptionPlaceholder')}
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Profesional — invisible con ≤1 profesional activa. Mismo patrón
            exacto que agenda/nuevo/page.tsx (chip row, tap-mismo-para-
            deseleccionar → null). */}
        {mostrarSelectorProfesional && (
          <div>
            <label style={labelStyle}>{t('professionalLabel')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeProfesionales.map(p => {
                const selected = selectedProfesionalId === p.id;
                const color = p.color || colors.primary;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSeleccionarProfesional(p.id)}
                    style={chipStyle(selected, color)}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      backgroundColor: selected ? '#FFF' : color,
                    }} />
                    {p.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
