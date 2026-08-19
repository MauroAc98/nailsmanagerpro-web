'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { List, type RowComponentProps } from 'react-window';
import { colors, shadows } from '@/theme/colors';
import { useClientesStore } from '@/store/useClienteStore';
import { Cliente } from '@/services/clienteService';
import { alertDialog } from '@/store/useConfirmStore';
import { abrirHistorial } from '@/store/useHistorialClienteStore';
import { NAV_HEIGHT } from '@/constants/layout';
import PillToggle from '@/components/PillToggle';

// Altura real de la tarjeta (~70px) + 10px de gap, horneado en la fila
// porque react-window no soporta gap entre filas absolutas.
const ROW_HEIGHT = 80;

function HistorialButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations('clientes.ClientesPage');
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label={t('historyButtonAriaLabel')}
      style={{
        height: 32, borderRadius: 16, flexShrink: 0,
        backgroundColor: colors.surfaceSubtle, border: 'none',
        padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.subtext} strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.subtext }}>{t('historyButton')}</span>
    </button>
  );
}

// Props "extra" de FilaCliente, sin `index`/`style`/`ariaAttributes` —
// react-window se los agrega solo. Tipado vía RowComponentProps (no un
// objeto inline con index/style incluidos a mano) para que TS infiera bien
// el genérico de <List rowProps={...}>: un objeto inline que ya trae
// index/style confunde esa inferencia (ExcludeForbiddenKeys_2 los tipa como
// `never` en vez de sacarlos, así que `rowProps` termina "pidiéndolos" con
// un tipo imposible de satisfacer).
interface FilaClienteProps {
  clientesPagina: Cliente[];
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations>;
  onToggle: (id: number, activo: boolean) => void;
}

// FilaCliente — fila de react-window (ver <List> en ClientesPage). Mismo
// contenido visual que la vieja ClienteCard, adaptado a la firma de
// rowComponent: recibe `index`/`style` de react-window más lo que se le
// pase por `rowProps`, y resuelve `cliente` indexando `clientesPagina` acá
// adentro (react-window no re-renderiza automáticamente si le pasás un
// `cliente` ya resuelto por fuera cuando cambia el array completo).
function FilaCliente({
  index, style, clientesPagina, router, t, onToggle,
}: RowComponentProps<FilaClienteProps>) {
  const cliente = clientesPagina[index];
  if (!cliente) return null;

  return (
    <div style={{ ...style, paddingBottom: 10, boxSizing: 'border-box' }}>
      <div
        onClick={() => router.push(`/clientes/${cliente.id}`)}
        style={{
          height: '100%', boxSizing: 'border-box',
          backgroundColor: colors.surface,
          borderRadius: 14,
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.card,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          opacity: cliente.activo ? 1 : 0.65,
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: cliente.activo ? colors.text : colors.placeholder }}>
            {cliente.nombre} {cliente.apellido}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.subtext }}>
            {cliente.telefono || t('noContactInfo')}
          </p>
        </div>

        <HistorialButton onClick={() => abrirHistorial(cliente.id)} />
        <PillToggle value={cliente.activo} onChange={activo => onToggle(cliente.id, activo)} stopPropagation />

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function ClientesPage() {
  const t = useTranslations('clientes.ClientesPage');
  const router = useRouter();
  const {
    clientesPagina, totalClientesPagina, cargandoPagina, cargandoMasPagina, error,
    cargarPrimeraPagina, cargarSiguientePagina, toggleCliente,
  } = useClientesStore();
  const [buscarInput, setBuscarInput] = useState('');

  useEffect(() => {
    cargarPrimeraPagina('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda server-side con debounce — cada tipeo reinicia el timer, así
  // no se dispara un fetch por tecla. Se salta la PRIMERA corrida de ESTE
  // efecto (la carga inicial ya la maneja el efecto de arriba) con un flag
  // propio, no compartido con el otro efecto — un ref puesto en `true` por
  // el efecto de montaje (versión anterior: `montado`) YA está en `true`
  // cuando este efecto corre por primera vez, porque React corre todos los
  // efectos de un componente en el mismo commit, en orden, sin ceder el
  // control entre uno y otro: el guard nunca frenaba nada, siempre
  // agendaba un segundo fetch a los 500ms (bug real, confirmado con
  // performance.getEntriesByType('resource') en producción — 2 GETs a
  // /api/clientes, ~500ms exactos de diferencia).
  const primeraCorridaBusqueda = useRef(true);
  useEffect(() => {
    if (primeraCorridaBusqueda.current) {
      primeraCorridaBusqueda.current = false;
      return;
    }
    const timer = setTimeout(() => cargarPrimeraPagina(buscarInput.trim()), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarInput]);

  return (
    <div style={{
      height: `calc(100dvh - ${NAV_HEIGHT}px - env(safe-area-inset-bottom))`,
      display: 'flex', flexDirection: 'column', backgroundColor: colors.background,
    }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/clientes/nuevo')}
        style={{
          position: 'fixed', bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primary, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215, 158, 164, 0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Buscador */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
          boxShadow: shadows.card, borderRadius: 12,
          paddingLeft: 14, paddingRight: 14, height: 48,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={buscarInput}
            onChange={e => setBuscarInput(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
          />
          {buscarInput && (
            <button onClick={() => setBuscarInput('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
          <p style={{ fontSize: 14, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Contenido: loading / vacío / lista virtualizada */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 20px' }}>
        {cargandoPagina ? (
          <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <div
              className="loader-spinner"
              style={{ width: 32, height: 32, borderRadius: 16, border: `3px solid ${colors.border}`, borderTopColor: colors.primary }}
            />
          </div>
        ) : clientesPagina.length === 0 ? (
          <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
            {buscarInput ? t('noResults') : t('emptyState')}
          </p>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {totalClientesPagina > 0 && (
              <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 8px 4px', flexShrink: 0 }}>
                {t('resultCount', { count: totalClientesPagina })}
              </p>
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <List
                rowComponent={FilaCliente}
                rowCount={clientesPagina.length}
                rowHeight={ROW_HEIGHT}
                rowProps={{
                  clientesPagina, router, t,
                  onToggle: async (id: number, activo: boolean) => {
                    const result = await toggleCliente(id, activo);
                    if (!result.success) await alertDialog(result.message ?? t('toggleError'));
                  },
                }}
                onRowsRendered={visible => {
                  if (visible.stopIndex >= clientesPagina.length - 3) cargarSiguientePagina();
                }}
                style={{ height: '100%', width: '100%' }}
              />
            </div>
            {cargandoMasPagina && (
              <p style={{ textAlign: 'center', padding: '8px 0', color: colors.subtext, fontSize: 13, flexShrink: 0 }}>
                {t('loadingMore')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
