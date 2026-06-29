'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useServiciosStore, useServiciosFiltrados } from '@/store/useServicioStore';
import { Servicio } from '@/services/servicioService';

const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;

function PillToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!value); }}
      style={{
        width: 44, height: 26, borderRadius: 13,
        backgroundColor: value ? colors.primary + '66' : '#EEE',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: value ? colors.primary : '#CCC',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

function ServicioCard({
  servicio,
  onEdit,
  onToggle,
  onDelete,
}: {
  servicio: Servicio;
  onEdit: () => void;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
}) {
  const [offset,    setOffset]    = useState(0);
  const [animating, setAnimating] = useState(false);

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
    liveOffset.current = Math.min(0, Math.max(-SWIPE_REVEAL, delta));
    setOffset(liveOffset.current);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : 0);
  };

  const handleClick = () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) { snapTo(0); return; }
    onEdit();
  };

  const precioLabel = servicio.precio ? `  ·  $${servicio.precio}` : '';

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
      {/* Delete panel */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: SWIPE_REVEAL, backgroundColor: '#FFADAD',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        cursor: 'pointer',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B0000" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#8B0000' }}>ELIMINAR</span>
      </div>

      {/* Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          backgroundColor: servicio.activo ? '#FFF' : '#FAFAFA',
          border: '1px solid #EEE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 14,
          padding: '14px 16px', cursor: 'pointer',
          transform: `translateX(${offset}px)`,
          transition: animating ? 'transform 0.25s ease' : 'none',
          opacity: servicio.activo ? 1 : 0.65,
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 36, height: 36,
          backgroundColor: servicio.activo ? '#FFF5F7' : '#F5F5F5',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={servicio.activo ? colors.primary : '#BBB'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: servicio.activo ? '#333' : '#AAA' }}>
            {servicio.nombre}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>
            {servicio.duracion_minutos} min{precioLabel}
          </p>
        </div>

        <PillToggle value={servicio.activo} onChange={onToggle} />

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
}

export default function ServiciosPage() {
  const router = useRouter();
  const { loading, buscar, fetchServicios, eliminarServicio, toggleServicio, setBuscar } = useServiciosStore();
  const serviciosFiltrados = useServiciosFiltrados();

  useEffect(() => { fetchServicios(); }, []);

  const handleEliminar = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminás "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const result = await eliminarServicio(id);
    if (!result.success) alert(result.message ?? 'No se pudo eliminar el servicio.');
  };


  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Servicios</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => router.push('/configuracion/servicios/nuevo')}
        style={{
          position: 'fixed', bottom: 86, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primary, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Search */}
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
            placeholder="Buscar servicio..."
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

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: 15 }}>Cargando servicios...</p>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {serviciosFiltrados.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: '#999', fontSize: 16 }}>
              {buscar ? 'No se encontraron coincidencias' : '¡Cargá tu primer servicio!'}
            </p>
          ) : (
            serviciosFiltrados.map(s => (
              <ServicioCard
                key={s.id}
                servicio={s}
                onEdit={() => router.push(`/configuracion/servicios/${s.id}`)}
                onToggle={activo => toggleServicio(s.id, activo)}
                onDelete={() => handleEliminar(s.id, s.nombre)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
