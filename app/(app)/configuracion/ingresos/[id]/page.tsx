'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useIngresosStore } from '@/store/useIngresoStore';
import { ingresoService, CATEGORIAS_INGRESO } from '@/services/ingresoService';
import { labelCategoriaIngreso } from '@/lib/categoriaLabel';
import { useAuth } from '@/hooks/useAuth';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';

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

export default function EditarIngresoPage() {
  const t    = useTranslations('configuracion.EditarIngresoPage');
  // Reusa las labels de categoría y la copia de confirmación de borrado ya
  // definidas en configuracion.IngresosPage (listado) — no se duplican acá.
  const tCat = useTranslations('configuracion.IngresosPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const { ingresos, actualizarIngreso, eliminarIngreso } = useIngresosStore();

  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [errorMonto, setErrorMonto] = useState('');
  const [loadingIngreso, setLoadingIngreso] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        // `useIngresosStore` solo mantiene cargado el rango de mes que la
        // pantalla de listado pidió por última vez — si se llega acá desde
        // un link viejo (otro mes, o el store recién arrancado), el ingreso
        // puede no estar en `ingresos`. Fallback a `ingresoService.getOne`,
        // mismo criterio que gastos/[id]/page.tsx.
        const fromStore = ingresos.find(i => i.id === id);
        const g = fromStore ?? await ingresoService.getOne(id);
        setFecha(g.fecha);
        setMonto(g.monto);
        setCategoria(g.categoria);
        setDescripcion(g.descripcion ?? '');
      } catch {
        await alertDialog(t('loadError'));
        router.push('/configuracion/ingresos');
      } finally {
        setLoadingIngreso(false);
      }
    };
    if (id) cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lista del salón (o set de fábrica) + la categoría ya guardada del
  // ingreso si quedó fuera de esa lista (la borraron) — así el chip sigue
  // visible y seleccionable y el guardado no obliga a cambiarla.
  const listaCategorias: readonly string[] = user?.categorias_ingreso ?? CATEGORIAS_INGRESO;
  const categoriasDisponibles: string[] = [
    ...listaCategorias,
    ...(categoria && !listaCategorias.includes(categoria) ? [categoria] : []),
  ];

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
    const result = await actualizarIngreso(id, {
      fecha,
      monto: montoNumerico,
      categoria,
      // null (no undefined) para poder borrar el campo — undefined se cae
      // del JSON al serializar y el PUT saldría sin la clave, mismo
      // criterio que gastos/[id]/page.tsx.
      descripcion: descripcion.trim() ? descripcion.trim() : null,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/ingresos');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  const handleEliminar = async () => {
    // Misma copia de confirmación que IngresoCard (listado) — el borrado es
    // duro y sin guarda referencial.
    const confirmado = await confirmDialog(
      tCat('deleteConfirm'),
      { confirmText: tCat('deleteConfirmButton'), danger: true }
    );
    if (!confirmado) return;

    setSaving(true);
    const result = await eliminarIngreso(id);
    setSaving(false);

    if (result.success) {
      showToast(tCat('deleted'));
      router.push('/configuracion/ingresos');
    } else {
      await alertDialog(result.message ?? tCat('deleteError'));
    }
  };

  if (loadingIngreso) {
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

        {/* Categoría — chips de la lista del salón (o el set de fábrica si
            no está cargada). Si el ingreso que se edita quedó con una
            categoría que la usuaria ya borró de su lista, se agrega igual al
            final para que sea seleccionable y se pueda guardar sin cambiarla. */}
        <div>
          <label style={labelStyle}>{t('categoryLabel')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {categoriasDisponibles.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                style={chipStyle(categoria === cat, colors.primarySolid)}
              >
                {labelCategoriaIngreso(cat, tCat)}
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

        {/* Delete — hard delete, misma copia de confirmación que
            IngresoCard.tsx (swipe, listado). Mismo criterio que
            gastos/[id]/page.tsx. */}
        <button
          onClick={handleEliminar}
          disabled={saving}
          style={{
            height: 52, borderRadius: 14,
            backgroundColor: 'transparent',
            border: `1px solid ${colors.dangerBorder}`,
            color: colors.danger, fontSize: 15, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {t('deleteButton')}
        </button>
      </div>
    </div>
  );
}
