'use client';

import { useEffect, useRef, useState, } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { colors, withAlpha, shadows } from '@/theme/colors';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { Slot } from '@/services/slotService';
import { profesionalJefa } from '@/services/profesionalService';
import { DrumPicker } from '@/components/DrumPicker';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import PillToggle from '@/components/PillToggle';

const HORAS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const SWIPE_REVEAL    = 90;
const SWIPE_THRESHOLD = 55;

function SlotCard({
  slot,
  onToggle,
  onDelete,
}: {
  slot: Slot;
  onToggle: (activo: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations('configuracion.SlotsPage');
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

  const cardBg = slot.activo ? colors.surface : colors.surfaceSubtle;

  return (
    <div style={{
      display: 'flex', borderRadius: 14, border: `1px solid ${colors.border}`,
      boxShadow: shadows.card, overflow: 'hidden',
      opacity: slot.activo ? 1 : 0.65,
    }}>
      {/* Ícono — ancho fijo, nunca se desliza (si se moviera junto con el
          resto, el overflow:hidden de la región deslizable lo clipearía). */}
      <div style={{
        width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, backgroundColor: cardBg,
      }}>
        <div style={{
          width: 36, height: 36,
          backgroundColor: slot.activo ? withAlpha(colors.primary, '15') : colors.surfaceSubtle,
          borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={slot.activo ? colors.primaryDeep : colors.placeholder} strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      </div>

      {/* Región deslizable — info + toggle, revela ELIMINAR detrás */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div
          onClick={onDelete}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: SWIPE_REVEAL, backgroundColor: colors.dangerBg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            cursor: 'pointer',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.danger }}>{t('delete')}</span>
        </div>

        <div
          ref={cardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 12,
            backgroundColor: cardBg,
            padding: '14px 16px 14px 0',
            userSelect: 'none',
            transform: 'translateX(0)',
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: slot.activo ? colors.text : colors.placeholder }}>
              {slot.hora} hs
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.subtext }}>
              {slot.activo ? t('available') : t('disabled')}
            </p>
          </div>

          <PillToggle value={slot.activo} onChange={onToggle} stopPropagation />
        </div>
      </div>
    </div>
  );
}

export default function SlotsPage() {
  const t = useTranslations('configuracion.SlotsPage');
  const { slots, loading, error, fetchSlots, agregarSlot, toggleSlot, eliminarSlot } = useSlotsStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [horaSeleccionada, setHoraSeleccionada] = useState<Record<string, string>>({ hora: '09', minuto: '00' });
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);

  // Multi-agenda — invisible para cuentas con ≤1 profesional activa (el caso
  // común hoy). Mismo criterio y patrón visual que la selección de
  // PROFESIONAL en app/(app)/agenda/nuevo/page.tsx.
  const activeProfesionales      = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;

  useEffect(() => { fetchProfesionales(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Con selector visible, defaultear a la profesional "jefa" (primera en
  // crearse) apenas esté disponible, para no dejar la pantalla vacía sin
  // selección — confirmado con el usuario (2026-08-19): acá corresponde
  // arrancar tildada en la jefa, no vacío (a diferencia de agenda/nuevo).
  // activeProfesionales[0] NO sirve acá — la lista viene ordenada por
  // nombre, no por antigüedad. Ajustado durante el render (no en un
  // efecto): la propia condición `selectedProfesionalId === null` se
  // vuelve falsa apenas se setea, así que converge en un solo render extra.
  if (mostrarSelectorProfesional && selectedProfesionalId === null) {
    const jefa = profesionalJefa(profesionales);
    if (jefa) setSelectedProfesionalId(jefa.id);
  }

  // Sin selector (≤1 profesional activa): comportamiento intacto, fetch
  // único sin scope, igual que antes de multi-agenda. Con selector: refetch
  // cada vez que cambia la profesional elegida.
  useEffect(() => {
    if (mostrarSelectorProfesional) {
      if (selectedProfesionalId !== null) fetchSlots(selectedProfesionalId);
    } else {
      fetchSlots();
    }
  }, [mostrarSelectorProfesional, selectedProfesionalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAgregarSlot = async () => {
    const timeStr   = `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`;
    const existente = slots.find(s => s.hora === timeStr);
    if (existente) {
      const msg = existente.activo
        ? t('duplicateActive')
        : t('duplicateInactive');
      await alertDialog(msg);
      setPickerVisible(false);
      return;
    }
    setPickerVisible(false);
    const result = await agregarSlot(
      timeStr,
      mostrarSelectorProfesional && selectedProfesionalId ? selectedProfesionalId : undefined,
    );
    if (result.success) showToast(t('added'));
    else await alertDialog(result.message ?? t('addError'));
  };

  const handleEliminar = async (id: number, hora: string) => {
    if (!(await confirmDialog(t('deleteConfirm', { hora }), { confirmText: t('deleteConfirmButton'), danger: true }))) return;
    const result = await eliminarSlot(id);
    if (result.success) showToast(t('deleted'));
    else await alertDialog(result.message ?? t('deleteError'));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* FAB */}
      <button
        onClick={() => setPickerVisible(true)}
        style={{
          position: 'fixed', bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom) + 8px)`, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primarySolid, border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215,158,164,0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Description */}
      <p style={{ margin: '0 20px 16px', fontSize: 14, color: colors.subtext, lineHeight: 1.5 }}>
        {t('subtitle')}
      </p>

      {/* Selector de profesional — invisible con ≤1 profesional activa */}
      {mostrarSelectorProfesional && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {activeProfesionales.map(p => {
            const selected = selectedProfesionalId === p.id;
            const color    = p.color || colors.primary;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProfesionalId(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  border: `1px solid ${selected ? color : colors.divider}`,
                  backgroundColor: selected ? color : colors.surface,
                  color: selected ? '#FFF' : colors.text,
                }}
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
      )}

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

      {/* List */}
      {!loading && !error && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slots.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: 50, color: colors.subtext, fontSize: 15 }}>
              {t('emptyState')}
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
              backgroundColor: colors.surface, borderRadius: '20px 20px 0 0',
              padding: '24px 24px 40px', width: '100%', maxWidth: 480,
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: '0 0 20px' }}>
              {t('addModalTitle')}
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
                backgroundColor: colors.primarySolid, color: '#fff',
                fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              {t('add')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
