'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { showToast } from '@/store/useToastStore';
import { confirmDialog } from '@/store/useConfirmStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import {
  agregarCategoria,
  renombrarCategoria,
  eliminarCategoria,
  normalizarCategoria,
  MAX_LARGO_CATEGORIA,
  type ErrorCategoria,
} from '@/lib/categoriasMovimiento';

type Tab = 'gasto' | 'ingreso';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  borderRadius: 10, padding: '11px 13px', fontSize: 15, color: colors.text, outline: 'none',
};

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function CategoriasMovimientosContent() {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // `?tab={gasto|ingreso}` es una SEED, no un binding (mismo patrón que
  // `?categoria={id}` en servicios/nuevo/page.tsx): se lee una sola vez acá,
  // en el inicializador de useState, nunca en un efecto. Los entry points de
  // Gastos e Ingresos son quienes mandan este param; sin él (o con un valor
  // inesperado) arranca en 'gasto', el default histórico.
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'ingreso' ? 'ingreso' : 'gasto'));

  const listaGuardada = user
    ? (tab === 'gasto' ? user.categorias_gasto : user.categorias_ingreso)
    : [];

  const tabButtonStyle = (activo: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderRadius: 9,
    backgroundColor: activo ? colors.surface : 'transparent',
    color: activo ? colors.textStrong : colors.subtext,
    boxShadow: activo ? shadows.card : 'none',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: NAV_CLEARANCE + 40 }}>
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 8px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.subtext }}>{t('subtitle')}</p>
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Toggle Gastos / Ingresos */}
        <div style={{
          display: 'flex', gap: 4, padding: 4, borderRadius: 12,
          backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`,
        }}>
          <button type="button" onClick={() => setTab('gasto')} style={tabButtonStyle(tab === 'gasto')}>
            {t('tabGastos')}
          </button>
          <button type="button" onClick={() => setTab('ingreso')} style={tabButtonStyle(tab === 'ingreso')}>
            {t('tabIngresos')}
          </button>
        </div>

        {/* `key` (tipo + user) remonta el editor al cambiar de pestaña o
            cuando el `user` recién termina de hidratar → el borrador arranca
            siempre desde la lista guardada de esa pestaña, sin useEffect de
            sincronización. Tras guardar, `listaGuardada` se actualiza sola
            (el store trae el user nuevo) y el "hay cambios" se apaga. */}
        {user
          ? <EditorCategorias key={`${tab}:${user.id}`} tipo={tab} listaGuardada={listaGuardada} />
          : <p style={{ margin: 0, fontSize: 14, color: colors.subtext }}>{t('loading')}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Default export — wraps in Suspense for useSearchParams (mismo patrón que
// app/(app)/configuracion/servicios/nuevo/page.tsx)
// ─────────────────────────────────────────────
export default function CategoriasMovimientosPage() {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: colors.subtext }}>{t('loading')}</div>}>
      <CategoriasMovimientosContent />
    </Suspense>
  );
}

function EditorCategorias({ tipo, listaGuardada }: { tipo: Tab; listaGuardada: string[] }) {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  const { updatePerfil } = useAuth();

  const [lista, setLista] = useState<string[]>(listaGuardada);
  const [nuevoValor, setNuevoValor] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValor, setEditValor] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const mostrarError = (e: ErrorCategoria) => setErrorLocal(t(`error_${e}`));

  // Persiste inmediatamente cada alta/edición/borrado — mismo estándar que
  // servicios/gastos/ingresos (sin un botón "Guardar cambios" separado que
  // dejaba la lista en un estado "borrador" ambiguo).
  const persistir = async (categorias: string[]) => {
    setGuardando(true);
    setErrorLocal(null);
    try {
      await updatePerfil(
        tipo === 'gasto' ? { categorias_gasto: categorias } : { categorias_ingreso: categorias },
      );
      setLista(categorias);
      showToast(t('saved'));
    } catch (e) {
      setErrorLocal(extraerMensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const handleAgregar = async () => {
    const r = agregarCategoria(lista, nuevoValor);
    if (!r.ok) return mostrarError(r.error);
    setNuevoValor('');
    await persistir(r.categorias);
  };

  const empezarEdicion = (index: number) => {
    setEditIndex(index);
    setEditValor(lista[index]);
    setErrorLocal(null);
  };

  const confirmarEdicion = async () => {
    if (editIndex === null) return;
    // Sin cambio real → cerrar sin validar (evita un falso "duplicada"
    // contra sí misma) ni un request de más.
    if (normalizarCategoria(editValor) === lista[editIndex]) {
      setEditIndex(null);
      return;
    }
    const r = renombrarCategoria(lista, editIndex, editValor);
    if (!r.ok) return mostrarError(r.error);
    setEditIndex(null);
    await persistir(r.categorias);
  };

  // Confirmación previa — mismo patrón que todo otro borrado en la app
  // (servicios, categorías de servicio, gastos, ingresos).
  const handleEliminar = async (index: number) => {
    const confirmado = await confirmDialog(
      t('deleteConfirm', { nombre: lista[index] }),
      { confirmText: t('deleteConfirmButton'), danger: true },
    );
    if (!confirmado) return;

    const r = eliminarCategoria(lista, index);
    if (!r.ok) return mostrarError(r.error);
    await persistir(r.categorias);
  };

  return (
    <>
      {/* Alta */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={nuevoValor}
          onChange={e => { setNuevoValor(e.target.value); setErrorLocal(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleAgregar(); }}
          placeholder={t('addPlaceholder')}
          maxLength={MAX_LARGO_CATEGORIA}
          disabled={guardando}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          onClick={handleAgregar}
          disabled={guardando}
          style={{
            flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none',
            backgroundColor: guardando ? colors.primaryDisabled : colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: guardando ? 'not-allowed' : 'pointer',
          }}
        >
          {t('addButton')}
        </button>
      </div>

      {errorLocal && <p style={{ margin: 0, fontSize: 13, color: colors.danger }}>{errorLocal}</p>}

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((cat, index) => (
          <div
            key={index}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
              boxShadow: shadows.card, borderRadius: 12, padding: '10px 12px',
            }}
          >
            {editIndex === index ? (
              <>
                <input
                  type="text"
                  value={editValor}
                  autoFocus
                  disabled={guardando}
                  onChange={e => setEditValor(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmarEdicion();
                    if (e.key === 'Escape') setEditIndex(null);
                  }}
                  onBlur={confirmarEdicion}
                  maxLength={MAX_LARGO_CATEGORIA}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '8px 11px' }}
                />
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={confirmarEdicion}
                  disabled={guardando}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', padding: 4, display: 'flex' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                {/* Nombre — texto plano, ya no es el disparador de edición
                    (nada indicaba que fuera tocable). Editar/borrar viven
                    ahora en sus propios íconos, siempre visibles. */}
                <p style={{
                  flex: 1, minWidth: 0, margin: 0, fontSize: 15, fontWeight: 600, color: colors.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {cat}
                </p>
                <button
                  type="button"
                  onClick={() => empezarEdicion(index)}
                  disabled={guardando}
                  aria-label={t('editLabel')}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', padding: 4, display: 'flex' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.subtext} strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleEliminar(index)}
                  disabled={guardando}
                  aria-label={t('deleteLabel')}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', padding: 4, display: 'flex' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Aviso: renombrar/borrar no reescribe los movimientos ya cargados */}
      <p style={{ margin: 0, fontSize: 12, color: colors.subtext, lineHeight: 1.4 }}>
        {t('historyNote')}
      </p>
    </>
  );
}
