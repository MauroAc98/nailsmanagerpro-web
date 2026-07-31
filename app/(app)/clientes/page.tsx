'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useClientesStore, useClientesFiltrados } from '@/store/useClienteStore';
import { Cliente } from '@/services/clienteService';
import { alertDialog } from '@/store/useConfirmStore';
import { abrirHistorial } from '@/store/useHistorialClienteStore';
import { NAV_HEIGHT } from '@/constants/layout';

// ─────────────────────────────────────────────
// ClienteCard — switch de activo/inactivo — sin swipe, sin borrado físico.
// ─────────────────────────────────────────────
function PillToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!value); }}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? withAlpha(colors.primary, '66') : colors.border,
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: value ? colors.primary : colors.placeholder,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

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

function ClienteCard({
  cliente,
  onPress,
  onToggle,
  onVerHistorial,
}: {
  cliente: Cliente;
  onPress:  () => void;
  onToggle: (activo: boolean) => void;
  onVerHistorial: () => void;
}) {
  const t = useTranslations('clientes.ClientesPage');
  return (
    <div
      onClick={onPress}
      style={{
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

      <HistorialButton onClick={onVerHistorial} />
      <PillToggle value={cliente.activo} onChange={onToggle} />

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function ClientesPage() {
  const t = useTranslations('clientes.ClientesPage');
  const router = useRouter();
  const { loading, error, buscar, fetchClientes, setBuscar, toggleCliente } = useClientesStore();
  const clientesFiltrados = useClientesFiltrados();

  useEffect(() => { fetchClientes(); }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>

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
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
          />
          {buscar && (
            <button onClick={() => setBuscar('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
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

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: colors.subtext, fontSize: 15 }}>{t('loading')}</p>
        </div>
      )}

      {/* Lista */}
      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clientesFiltrados.length > 0 && (
            <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 0 4px' }}>
              {t('resultCount', { count: clientesFiltrados.length })}
            </p>
          )}
          {clientesFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 16 }}>
              {buscar ? t('noResults') : t('emptyState')}
            </p>
          ) : (
            clientesFiltrados.map(cliente => (
              <ClienteCard
                key={cliente.id}
                cliente={cliente}
                onPress={() => router.push(`/clientes/${cliente.id}`)}
                onToggle={async activo => {
                  const result = await toggleCliente(cliente.id, activo);
                  if (!result.success) await alertDialog(result.message ?? t('toggleError'));
                }}
                onVerHistorial={() => abrirHistorial(cliente.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
