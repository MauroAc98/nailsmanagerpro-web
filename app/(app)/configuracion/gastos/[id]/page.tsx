'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useGastosStore } from '@/store/useGastoStore';
import { gastoService, CATEGORIAS_GASTO } from '@/services/gastoService';
import { labelCategoriaGasto } from '@/lib/categoriaLabel';
import { useAuth } from '@/hooks/useAuth';
import { useProfesionalStore } from '@/store/useProfesionalStore';
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

export default function EditarGastoPage() {
  const t    = useTranslations('configuracion.EditarGastoPage');
  // Reusa las labels de categoría y la copia de confirmación de borrado ya
  // definidas en configuracion.GastosPage (listado) — no se duplican acá.
  const tCat = useTranslations('configuracion.GastosPage');
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const { gastos, actualizarGasto, eliminarGasto } = useGastosStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [errorMonto, setErrorMonto] = useState('');
  const [loadingGasto, setLoadingGasto] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profesionales.length === 0) fetchProfesionales();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cargar = async () => {
      try {
        // `useGastosStore` solo mantiene cargado el rango de mes que la
        // pantalla de listado pidió por última vez — si se llega acá desde
        // un link viejo (otro mes, o el store recién arrancado), el gasto
        // puede no estar en `gastos`. Fallback a `gastoService.getOne`,
        // mismo criterio que servicios/[id]/page.tsx con `servicioService`.
        const fromStore = gastos.find(g => g.id === id);
        const g = fromStore ?? await gastoService.getOne(id);
        setFecha(g.fecha);
        setMonto(g.monto);
        setCategoria(g.categoria);
        setDescripcion(g.descripcion ?? '');
        setSelectedProfesionalId(g.profesional_id);
      } catch {
        await alertDialog(t('loadError'));
        router.push('/configuracion/gastos');
      } finally {
        setLoadingGasto(false);
      }
    };
    if (id) cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Multi-agenda — invisible con ≤1 profesional activa, mismo criterio que
  // agenda/nuevo/page.tsx y gastos/nuevo/page.tsx. La atribución sobrevive
  // a profesionales desactivadas (spec), por eso `profesionales` acá no se
  // filtra por `activo` al resolver el valor ya guardado, solo al listar
  // opciones seleccionables.
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;

  // Lista del salón (o set de fábrica) + la categoría ya guardada del gasto
  // si quedó fuera de esa lista (la borraron) — así el chip sigue visible y
  // seleccionable y el guardado no obliga a cambiarla.
  const listaCategorias: readonly string[] = user?.categorias_gasto ?? CATEGORIAS_GASTO;
  const categoriasDisponibles: string[] = [
    ...listaCategorias,
    ...(categoria && !listaCategorias.includes(categoria) ? [categoria] : []),
  ];

  const handleSeleccionarProfesional = (pid: number) => {
    setSelectedProfesionalId(prev => prev === pid ? null : pid);
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
    const result = await actualizarGasto(id, {
      fecha,
      monto: montoNumerico,
      categoria,
      // null (no undefined) para poder borrar el campo — undefined se cae
      // del JSON al serializar y el PUT saldría sin la clave, mismo
      // criterio que servicios/[id]/page.tsx con `precio`.
      descripcion: descripcion.trim() ? descripcion.trim() : null,
      // Sin selector visible (≤1 profesional activa) el usuario no puede
      // cambiar este valor — se reenvía tal cual se cargó, mismo criterio
      // que el resto del formulario para campos no editables en ese caso.
      profesional_id: selectedProfesionalId,
    });
    setSaving(false);

    if (result.success) {
      router.push('/configuracion/gastos');
    } else {
      await alertDialog(result.message ?? t('saveError'));
    }
  };

  const handleEliminar = async () => {
    // Misma copia de confirmación que GastoCard (listado) — el borrado es
    // duro y sin guarda referencial, ver spec.md.
    const confirmado = await confirmDialog(
      tCat('deleteConfirm'),
      { confirmText: tCat('deleteConfirmButton'), danger: true }
    );
    if (!confirmado) return;

    setSaving(true);
    const result = await eliminarGasto(id);
    setSaving(false);

    if (result.success) {
      showToast(tCat('deleted'));
      router.push('/configuracion/gastos');
    } else {
      await alertDialog(result.message ?? tCat('deleteError'));
    }
  };

  if (loadingGasto) {
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
            no está cargada). Si el gasto que se edita quedó con una
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
                {labelCategoriaGasto(cat, tCat)}
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

        {/* Profesional — invisible con ≤1 profesional activa. */}
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
            backgroundColor: saving ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff', fontSize: 16, fontWeight: 600,
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>

        {/* Delete — hard delete, misma copia de confirmación que
            GastoCard.tsx (swipe, listado). No hay precedente de un botón
            de borrado inline en las demás pantallas [id] (servicios,
            profesionales, clientes) — este es nuevo para gastos porque el
            listado ya ofrece swipe-to-delete pero el flujo de edición
            también necesita una salida de borrado sin volver atrás. */}
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
