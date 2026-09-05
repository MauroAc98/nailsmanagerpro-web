'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { agendaColors as colors } from '@/theme/agendaColors';
import { useCategoriasServicioStore } from '@/store/useCategoriaServicioStore';

interface Props {
  value: number | null;
  onChange: (categoriaId: number | null) => void;
  disabled?: boolean;
}

// Sin reducer — dos estados simples alcanzan (design D4/D5). `creando`
// guarda su propio nombre/error/saving en vez de useState separados para
// que una sola asignación cierre el formulario inline atómicamente.
type Modo =
  | { tipo: 'chips' }
  | { tipo: 'creando'; nombre: string; error: string; saving: boolean };

// Mismo patrón que el chip de categoría que reemplaza en nuevo/[id]/page.tsx
// (color fijo, sin punto de color por-item, solo texto — sin ícono por
// categoría, ver refactor/quitar-iconos-categoria).
function chipStyle(selected: boolean, dashed = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
    border: `1px ${dashed ? 'dashed' : 'solid'} ${selected ? colors.primarySolid : colors.divider}`,
    backgroundColor: selected ? colors.primarySolid : colors.surface,
    color: selected ? '#FFF' : colors.text,
  };
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, boxSizing: 'border-box',
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  borderRadius: 12, padding: '10px 14px', fontSize: 14, color: colors.text, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: colors.textStrong,
  marginBottom: 7, display: 'block', marginLeft: 2,
};

// Selector de categoría + creador inline compartido por nuevo/[id]/page.tsx
// (spec: service-category-assignment — siempre visible, primer campo,
// nunca gatea la creación detrás de un picker de color/ícono). Reemplaza el
// bloque de chips que antes vivía duplicado en cada página, y el
// `{categorias.length > 0 && ...}` que ocultaba el selector entero con cero
// categorías — ese gate era justamente el bug que este componente resuelve
// (spec: "Zero categories still shows the selector").
export function SelectorCategoriaServicio({ value, onChange, disabled }: Props) {
  const t = useTranslations('configuracion.SelectorCategoriaServicio');
  const { categorias, loading, error, fetchCategorias, agregarCategoria } = useCategoriasServicioStore();
  const [modo, setModo] = useState<Modo>({ tipo: 'chips' });

  // El componente es dueño de su propia colección (design D4) — las
  // páginas ya no disparan este fetch; solo siguen leyendo `loading` para
  // el guard de submit (comentario en nuevo/page.tsx sobre el
  // withGlobalLoader compartido, sigue vigente sin cambios acá).
  useEffect(() => {
    if (categorias.length === 0) fetchCategorias();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // D5: reconciliación. `value` puede venir de un `?categoria=` seed obsoleto
  // (categoría borrada entre la creación del link y la apertura del form) o
  // de una categoría borrada en otra pestaña mientras el form de edición
  // estaba abierto — en ambos casos, sin esto, el submit mandaría un
  // `categoria_id` inexistente y el backend respondería 422 sin ningún aviso
  // previo en la UI.
  useEffect(() => {
    if (!loading && categorias.length > 0 && value !== null && !categorias.some(c => c.id === value)) {
      onChange(null);
    }
  }, [loading, categorias, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeleccionar = (id: number) => {
    onChange(value === id ? null : id);
  };

  const handleIniciarCreacion = () => {
    setModo({ tipo: 'creando', nombre: '', error: '', saving: false });
  };

  const handleCancelar = () => {
    setModo({ tipo: 'chips' });
  };

  const handleConfirmarCreacion = async () => {
    if (modo.tipo !== 'creando' || modo.saving) return;

    const nombre = modo.nombre.trim();
    if (!nombre) {
      setModo({ ...modo, error: t('nameRequired') });
      return;
    }

    // Mismo criterio (trim + toLowerCase, sin normalizar acentos) que
    // categorias/nuevo/page.tsx — pre-check de UX, el backend sigue siendo
    // la fuente de verdad y su 422 llega igual vía `result.message` si esta
    // pre-check no lo detecta primero.
    const nombreNormalizado = nombre.toLowerCase();
    const existente = categorias.find(c => c.nombre.toLowerCase() === nombreNormalizado);
    if (existente) {
      setModo({ ...modo, error: t('duplicate') });
      return;
    }

    setModo({ tipo: 'creando', nombre, error: '', saving: true });
    const result = await agregarCategoria({ nombre });

    if (result.success) {
      // `categoria` ausente en un success es un caso defensivo del tipo
      // aditivo del store (nunca debería pasar en la práctica) — cuando
      // pasa, no hay nada que auto-seleccionar; la selección previa queda
      // intacta y el usuario puede elegirla a mano de la lista recargada.
      if (result.categoria) onChange(result.categoria.id);
      setModo({ tipo: 'chips' });
    } else {
      setModo({ tipo: 'creando', nombre, error: result.message ?? t('saveError'), saving: false });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') handleCancelar();
    if (e.key === 'Enter') handleConfirmarCreacion();
  };

  return (
    <div>
      <label style={labelStyle}>{t('label')}</label>

      {modo.tipo === 'chips' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {/* "Sin categoría" explícito — mismo criterio que el chip que
              reemplaza: más claro que depender solo de tap-en-la-misma-chip
              para deseleccionar. */}
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            style={chipStyle(value === null)}
          >
            {t('none')}
          </button>
          {categorias.map(cat => {
            const selected = value === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSeleccionar(cat.id)}
                disabled={disabled}
                style={chipStyle(selected)}
              >
                {cat.nombre}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleIniciarCreacion}
            disabled={disabled}
            style={chipStyle(false, true)}
          >
            <Plus size={16} strokeWidth={2} />
            {t('newCategory')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              type="text"
              placeholder={t('namePlaceholder')}
              value={modo.nombre}
              onChange={e => setModo({ ...modo, nombre: e.target.value, error: '' })}
              onKeyDown={handleKeyDown}
              disabled={modo.saving || disabled}
              style={{ ...inputStyle, borderColor: modo.error ? colors.dangerBorder : colors.border }}
            />
            <button
              type="button"
              onClick={handleConfirmarCreacion}
              disabled={modo.saving || disabled}
              style={{
                borderRadius: 12, padding: '0 16px', fontSize: 14, fontWeight: 600, flexShrink: 0,
                border: 'none', cursor: (modo.saving || disabled) ? 'not-allowed' : 'pointer',
                backgroundColor: modo.saving ? colors.primaryDisabled : colors.primarySolid,
                color: '#FFF',
              }}
            >
              {modo.saving ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              onClick={handleCancelar}
              disabled={modo.saving || disabled}
              aria-label={t('cancel')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: 40, height: 40, borderRadius: 12,
                border: `1px solid ${colors.border}`, backgroundColor: colors.surface,
                color: colors.text, cursor: (modo.saving || disabled) ? 'not-allowed' : 'pointer',
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          {/* Error inline, nunca alertDialog (design D4/D5) — un modal sobre
              un formulario inline sería una regresión de UX. */}
          {modo.error && <p style={{ margin: '2px 0 0 2px', fontSize: 12, color: colors.dangerBorder }}>{modo.error}</p>}
        </div>
      )}

      {/* Mismo criterio que el bloque que reemplaza: sin esto, un fetch
          fallido es indistinguible de "esta cuenta no tiene categorías". */}
      {error && categorias.length === 0 && (
        <p style={{ margin: '6px 0 0 2px', fontSize: 12, color: colors.subtext }}>{t('loadError')}</p>
      )}
    </div>
  );
}
