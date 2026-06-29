'use client';

import { useEffect, useRef, useState, } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useSlotsStore } from '@/store/useSlotsStore';
import { Slot } from '@/services/slotService';
import { DrumPicker } from '@/components/DrumPicker';

const HORAS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const SWIPE_REVEAL    = 90;
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

function SlotCard({
  slot,
  onToggle,
  onDelete,
}: {
  slot: Slot;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
}) {
  const cardRef    = useRef<HTMLDivElement>(null);
  const startX     = useRef(0);
  const initOffset = useRef(0);
  const liveOffset = useRef(0);
  const dragged    = useRef(false);

  const applyTransform = (offset: number, animate: boolean) => {
    if (!cardRef.current) return;
    cardRef.current.style.transition = animate
      ? 'transform 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : 'none';
    cardRef.current.style.transform = `translateX(${offset}px)`;
  };

  const snapTo = (target: number) => {
    liveOffset.current = target;
    applyTransform(target, true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    applyTransform(clamped, false);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : 0);
  };

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
      {/* Delete panel */}
      <div
        onClick={onDelete}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: SWIPE_REVEAL, backgroundColor: '#FFADAD',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          cursor: 'pointer',
        }}
      >
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
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          backgroundColor: slot.activo ? '#FFF' : '#FAFAFA',
          border: '1px solid #EEE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 14,
          padding: '14px 16px',
          opacity: slot.activo ? 1 : 0.65,
          userSelect: 'none',
          transform: 'translateX(0)',
        }}
      >
        <div style={{
          width: 36, height: 36,
          backgroundColor: slot.activo ? '#FFF5F7' : '#F5F5F5',
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={slot.activo ? colors.primary : '#BBB'} strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: slot.activo ? '#333' : '#AAA' }}>
            {slot.hora} hs
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>
            {slot.activo ? 'Disponible' : 'Desactivado'}
          </p>
        </div>

        <PillToggle value={slot.activo} onChange={onToggle} />
      </div>
    </div>
  );
}

export default function SlotsPage() {
  const router = useRouter();
  const { slots, loading, fetchSlots, agregarSlot, toggleSlot, eliminarSlot } = useSlotsStore();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [horaSeleccionada, setHoraSeleccionada] = useState<Record<string, string>>({ hora: '09', minuto: '00' });

  useEffect(() => { fetchSlots(); }, []);

  const handleAgregarSlot = async () => {
    const timeStr   = `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`;
    const existente = slots.find(s => s.hora === timeStr);
    if (existente) {
      const msg = existente.activo
        ? 'Ya existe un slot para ese horario.'
        : 'Ya tenés un slot para ese horario (inactivo). Activalo desde el listado.';
      alert(msg);
      setPickerVisible(false);
      return;
    }
    setPickerVisible(false);
    const result = await agregarSlot(timeStr);
    if (!result.success) alert(result.message ?? 'No se pudo agregar el horario.');
  };

  const handleEliminar = async (id: number, hora: string) => {
    if (!confirm(`¿Eliminás el slot de las ${hora}?`)) return;
    const result = await eliminarSlot(id);
    if (!result.success) alert(result.message ?? 'No se pudo eliminar el horario.');
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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Horarios Disponibles</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => setPickerVisible(true)}
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

      {/* Description */}
      <p style={{ margin: '0 20px 16px', fontSize: 14, color: '#888', lineHeight: 1.5 }}>
        Estos son los horarios en los que tus clientes pueden reservar turnos.
      </p>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: 15 }}>Cargando horarios...</p>
        </div>
      )}

      {/* List */}
      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slots.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: '#999', fontSize: 15 }}>
              No hay horarios cargados. Tocá + para agregar uno.
            </p>
          ) : (
            slots.map(s => (
              <SlotCard
                key={s.id}
                slot={s}
                onToggle={activo => toggleSlot(s.id, activo)}
                onDelete={() => handleEliminar(s.id, s.hora)}
              />
            ))
          )}
        </div>
      )}

      {/* Time picker modal */}
      {pickerVisible && (
        <div
          onClick={() => setPickerVisible(false)}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#FFF', borderRadius: '20px 20px 0 0',
              padding: '24px 24px 40px', width: '100%', maxWidth: 480,
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#333', margin: '0 0 20px' }}>
              Agregar horario
            </h2>
            <DrumPicker
              columns={[
                { name: 'hora',   items: HORAS },
                { name: 'minuto', items: MINUTOS },
              ]}
              value={horaSeleccionada}
              onChange={setHoraSeleccionada}
            />
            <button
              onClick={handleAgregarSlot}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                backgroundColor: colors.primary, color: '#fff',
                fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
