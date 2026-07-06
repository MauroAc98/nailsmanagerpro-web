'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useClientesStore, useClientesFiltrados } from '@/store/useClienteStore';
import { Cliente } from '@/services/clienteService';

// ─────────────────────────────────────────────
// ClienteCard — sin swipe ni eliminar, RN no tiene esa capacidad
// (ni en la lista ni en el formulario de edición).
// ─────────────────────────────────────────────
function ClienteCard({ cliente, onPress }: { cliente: Cliente; onPress: () => void }) {
  return (
    <div
      onClick={onPress}
      style={{
        backgroundColor: '#FFF',
        borderRadius: 14,
        border: '1px solid #EEE',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#333' }}>
          {cliente.nombre} {cliente.apellido}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
          {cliente.telefono || 'Sin datos de contacto'}
        </p>
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function ClientesPage() {
  const router = useRouter();
  const { loading, error, buscar, fetchClientes, setBuscar } = useClientesStore();
  const clientesFiltrados = useClientesFiltrados();

  useEffect(() => { fetchClientes(); }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>Clientes</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/clientes/nuevo')}
        style={{
          position: 'fixed', bottom: 86, right: 24,
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
          backgroundColor: '#FFF', border: '1px solid #EEE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12,
          paddingLeft: 14, paddingRight: 14, height: 48,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
          />
          {buscar && (
            <button onClick={() => setBuscar('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', borderRadius: 8, backgroundColor: '#fdecea', borderLeft: '4px solid #e57373' }}>
          <p style={{ fontSize: 14, color: '#c62828', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: 15 }}>Cargando clientes...</p>
        </div>
      )}

      {/* Lista */}
      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clientesFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 }}>
              {buscar ? 'No se encontraron clientes' : '¡Cargá a tu primer cliente!'}
            </p>
          ) : (
            clientesFiltrados.map(cliente => (
              <ClienteCard
                key={cliente.id}
                cliente={cliente}
                onPress={() => router.push(`/clientes/${cliente.id}`)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
