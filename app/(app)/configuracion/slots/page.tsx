'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaFontSerif } from '@/theme/agendaColors';
import { withAlpha } from '@/theme/colors';
import { inicialesProfesional } from '@/lib/inicialesProfesional';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { profesionalJefa } from '@/services/profesionalService';
import { DrumPicker } from '@/components/DrumPicker';
import { confirmDialog, alertDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { NAV_CLEARANCE } from '@/constants/layout';
import { SlotCard } from '@/components/configuracion/SlotCard';

const HORAS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

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

  const handleToggle = async (id: number, hora: string, activo: boolean) => {
    if (!activo && !(await confirmDialog(t('deactivateConfirm', { hora }), { confirmText: t('deactivateConfirmButton'), danger: true }))) return;
    await toggleSlot(id, activo);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>
      {/* Header — BackButton en su propia fila, h1 serif debajo (mismo
          patrón que el resto de las pantallas migradas). */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>
      <div style={{ padding: '4px 20px 12px' }}>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>{t('title')}</h1>
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
                  borderRadius: 20, padding: '4px 16px 4px 4px', fontSize: 14, cursor: 'pointer',
                  border: `1px solid ${selected ? color : colors.divider}`,
                  backgroundColor: selected ? color : colors.surface,
                  color: selected ? '#FFF' : colors.text,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800,
                  backgroundColor: selected ? withAlpha('#fff', '3D') : withAlpha(color, '26'),
                  color: selected ? '#fff' : color,
                }}>
                  {inicialesProfesional(p.nombre, p.apellido)}
                </span>
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
                onToggle={activo => handleToggle(s.id, s.hora, activo)}
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
