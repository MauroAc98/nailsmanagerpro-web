'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useIngresosStore } from '@/store/useIngresoStore';
import { CATEGORIAS_INGRESO, CategoriaIngreso } from '@/services/ingresoService';
import { alertDialog } from '@/store/useConfirmStore';
import { fechaDeHoy } from '@/lib/dateFormat';

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
  return fechaDeHoy();
}

export default function NuevoIngresoPage() {
  const t    = useTranslations('configuracion.NuevoIngresoPage');
  // Las labels de categoría (`category_venta_productos`, etc.) viven en
  // configuracion.IngresosPage desde la pantalla de listado — se reusan
  // acá en vez de duplicarlas bajo NuevoIngresoPage.
  const tCat = useTranslations('configuracion.IngresosPage');
  const router = useRouter();
  const { agregarIngreso } = useIngresosStore();

  const [fecha, setFecha] = useState(fechaHoy());
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<CategoriaIngreso | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [errorMonto, setErrorMonto] = useState('');
  const [saving, setSaving] = useState(false);

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
    const result = await agregarIngreso({
      fecha,
      monto: montoNumerico,
      categoria,
      descripcion: descripcion.trim() ? descripcion.trim() : undefined,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/ingresos');
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

        {/* Categoría — set fijo de 3 opciones (CATEGORIAS_INGRESO), nunca
            texto libre. Mismo criterio que gastos. */}
        <div>
          <label style={labelStyle}>{t('categoryLabel')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIAS_INGRESO.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                style={chipStyle(categoria === cat, colors.primarySolid)}
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
