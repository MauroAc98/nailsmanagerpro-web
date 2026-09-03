'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { useAuth } from '@/hooks/useAuth';
import { extraerMensajeError } from '@/services/clienteService';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import {
  agregarCategoria,
  renombrarCategoria,
  eliminarCategoria,
  categoriasIguales,
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

export default function CategoriasMovimientosPage() {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('gasto');

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

function EditorCategorias({ tipo, listaGuardada }: { tipo: Tab; listaGuardada: string[] }) {
  const t = useTranslations('configuracion.CategoriasMovimientoPage');
  const { updatePerfil } = useAuth();

  const [lista, setLista] = useState<string[]>(listaGuardada);
  const [nuevoValor, setNuevoValor] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValor, setEditValor] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const hayCambios = !categoriasIguales(lista, listaGuardada);

  const mostrarError = (e: ErrorCategoria) => setErrorLocal(t(`error_${e}`));

  const handleAgregar = () => {
    const r = agregarCategoria(lista, nuevoValor);
    if (!r.ok) return mostrarError(r.error);
    setLista(r.categorias);
    setNuevoValor('');
    setErrorLocal(null);
  };

  const empezarEdicion = (index: number) => {
    setEditIndex(index);
    setEditValor(lista[index]);
    setErrorLocal(null);
  };

  const confirmarEdicion = () => {
    if (editIndex === null) return;
    // Sin cambio real → cerrar sin validar (evita un falso "duplicada"
    // contra sí misma).
    if (normalizarCategoria(editValor) === lista[editIndex]) {
      setEditIndex(null);
      return;
    }
    const r = renombrarCategoria(lista, editIndex, editValor);
    if (!r.ok) return mostrarError(r.error);
    setLista(r.categorias);
    setEditIndex(null);
    setErrorLocal(null);
  };

  const handleEliminar = (index: number) => {
    const r = eliminarCategoria(lista, index);
    if (!r.ok) return mostrarError(r.error);
    setLista(r.categorias);
    setErrorLocal(null);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setErrorLocal(null);
    try {
      await updatePerfil(
        tipo === 'gasto' ? { categorias_gasto: lista } : { categorias_ingreso: lista },
      );
      showToast(t('saved'));
    } catch (e) {
      setErrorLocal(extraerMensajeError(e));
    } finally {
      setGuardando(false);
    }
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
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          onClick={handleAgregar}
          style={{
            flexShrink: 0, padding: '0 16px', borderRadius: 10, border: 'none',
            backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
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
                  onChange={e => setEditValor(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmarEdicion();
                    if (e.key === 'Escape') setEditIndex(null);
                  }}
                  onBlur={confirmarEdicion}
                  maxLength={MAX_LARGO_CATEGORIA}
                  style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={confirmarEdicion}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => empezarEdicion(index)}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontSize: 15, fontWeight: 600, color: colors.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {cat}
                </button>
                <button
                  type="button"
                  onClick={() => handleEliminar(index)}
                  aria-label={t('deleteLabel')}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
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

      {/* Guardar */}
      <button
        type="button"
        onClick={handleGuardar}
        disabled={!hayCambios || guardando}
        style={{
          marginTop: 4, height: 50, borderRadius: 14, border: 'none',
          backgroundColor: (!hayCambios || guardando) ? colors.primaryDisabled : colors.primarySolid,
          color: '#fff', fontSize: 15, fontWeight: 600,
          cursor: (!hayCambios || guardando) ? 'not-allowed' : 'pointer',
        }}
      >
        {guardando ? t('saving') : t('saveButton')}
      </button>
    </>
  );
}
