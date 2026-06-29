'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useClientesStore, useClientesFiltrados } from '@/store/useClienteStore';
import { Cliente } from '@/services/clienteService';

// ─────────────────────────────────────────────
// Constantes de swipe
// ─────────────────────────────────────────────
const SWIPE_REVEAL    = 80;  // px máximos que se desliza el card
const SWIPE_THRESHOLD = 55;  // px mínimos para hacer snap al estado abierto

// ─────────────────────────────────────────────
// SwipeableClienteCard
// ─────────────────────────────────────────────
function SwipeableClienteCard({
  cliente,
  onEdit,
  onDelete,
}: {
  cliente: Cliente;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const [offset,    setOffset]    = useState(0);
  const [animating, setAnimating] = useState(false);
  const [hovered,   setHovered]   = useState(false);

  const startX     = useRef(0);
  const liveOffset = useRef(0);
  const dragged    = useRef(false);

  const snapTo = (target: number) => {
    setAnimating(true);
    setOffset(target);
    liveOffset.current = target;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    dragged.current = false;
    setAnimating(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, delta));
    liveOffset.current = clamped;
    setOffset(clamped);
  };

  const handleTouchEnd = () => {
    if (liveOffset.current < -SWIPE_THRESHOLD) {
      snapTo(-SWIPE_REVEAL);
    } else {
      snapTo(0);
    }
  };

  const handleCardClick = () => {
    if (dragged.current) return;
    // Si el card está abierto, cerrarlo con el tap
    if (liveOffset.current < -10) { snapTo(0); return; }
    onEdit();
  };

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>

      {/* Panel de eliminar (detrás del card) */}
      <div
        onClick={onDelete}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: SWIPE_REVEAL,
          backgroundColor: '#FFADAD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B0000" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </div>

      {/* Card deslizable */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: '#FFF',
          borderRadius: 14,
          border: '1px solid #EEE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          transform: `translateX(${offset}px)`,
          transition: animating ? 'transform 0.25s ease' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
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

        {/* Botón eliminar en hover (desktop) */}
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFADAD" strokeWidth="1.8">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}

        {/* Chevron → indica que es clickeable */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2">
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
  const router = useRouter();
  const { loading, error, buscar, fetchClientes, eliminarCliente, setBuscar } = useClientesStore();
  const clientesFiltrados = useClientesFiltrados();

  useEffect(() => { fetchClientes(); }, []);

  const handleEliminar = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminás a ${nombre}? Esta acción no se puede deshacer.`)) return;
    const result = await eliminarCliente(id);
    if (!result.success) alert(result.message ?? 'No se pudo eliminar el cliente.');
  };

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
              <SwipeableClienteCard
                key={cliente.id}
                cliente={cliente}
                onEdit={() => router.push(`/clientes/${cliente.id}`)}
                onDelete={() => handleEliminar(cliente.id, `${cliente.nombre} ${cliente.apellido}`)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
