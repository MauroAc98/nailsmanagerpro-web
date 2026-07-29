'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { colors, shadows } from '@/theme/colors';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { Cliente } from '@/services/clienteService';
import { DrumPicker } from '@/components/DrumPicker';
import { validarTurno } from '@/lib/turnoValidaciones';
import { alertDialog } from '@/store/useConfirmStore';
import { formatFecha } from '@/lib/dateFormat';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return formatFecha(d, 'diaSemanaFechaMes');
}

function formatHora12(hora24: string): string {
  const parts = hora24.split(':').map(Number);
  const h     = parts[0];
  const m     = parts[1];
  const ampm  = h >= 12 ? 'p. m.' : 'a. m.';
  const h12   = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm} hs`;
}

// ─────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: colors.placeholder, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
  boxShadow: shadows.card, borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: colors.text,
};

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function NuevoTurnoContent() {
  const router       = useRouter();
  const t            = useTranslations('agenda.NuevoTurnoPage');
  const searchParams = useSearchParams();
  const today        = new Date().toISOString().split('T')[0];
  const fecha        = searchParams.get('fecha') ?? today;

  const { crearTurno, turnos, fetchTurnos }  = useTurnoStore();
  const { servicios, fetchServicios }        = useServiciosStore();
  const { clientes, fetchClientes }          = useClientesStore();
  const { slots, fetchSlots }                = useSlotsStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [selectedCliente,      setSelectedCliente]      = useState<Cliente | null>(null);
  const [selectedServicioIds,  setSelectedServicioIds]  = useState<number[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [showClienteDropdown,  setShowClienteDropdown]  = useState(false);
  const [clienteBuscar,        setClienteBuscar]        = useState('');
  const [showHoraPicker,       setShowHoraPicker]       = useState(false);
  const [saving,               setSaving]               = useState(false);

  const now      = new Date();
  const initialH = String(now.getHours()).padStart(2, '0');
  const [horaSeleccionada, setHoraSeleccionada] = useState<Record<string, string>>({ hora: initialH, minuto: '00' });
  const [tempHora,         setTempHora]         = useState<Record<string, string>>({ hora: initialH, minuto: '00' });

  useEffect(() => {
    if (clientes.length === 0) fetchClientes();
    if (servicios.length === 0) fetchServicios();
    if (slots.length === 0) fetchSlots();
    if (profesionales.length === 0) fetchProfesionales();
    fetchTurnos(fecha);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────
  // Multi-agenda — invisible for accounts with ≤1 active profesional (el
  // caso común hoy, porque toda cuenta tiene al menos una default).
  // ─────────────────────────────────────────────
  const activeProfesionales      = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const profesionalSeleccionado  = activeProfesionales.find(p => p.id === selectedProfesionalId) ?? null;

  // Cada profesional tiene sus propias horas de atención. Cuando cambia la
  // profesional elegida en el paso PROFESIONAL, refetch de slots escopeado a
  // ella para que validarTurno (bloqueo de horarios) refleje sus horas
  // reales. Sin selector (≤1 profesional activa) esto nunca se dispara — el
  // fetch inicial sin scope del mount (arriba) queda intacto.
  useEffect(() => {
    if (mostrarSelectorProfesional && selectedProfesionalId) {
      fetchSlots(selectedProfesionalId);
    }
  }, [mostrarSelectorProfesional, selectedProfesionalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleServicio = (id: number) => {
    setSelectedServicioIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSeleccionarProfesional = (id: number) => {
    setSelectedProfesionalId(prev => prev === id ? null : id);
    // Los servicios disponibles cambian con la profesional — no arrastrar
    // selecciones que puede que ya no ofrezca.
    setSelectedServicioIds([]);
  };

  // Con selector visible, solo se ofrecen los servicios de la profesional
  // elegida (vacío hasta elegir una). Sin selector, comportamiento intacto.
  const serviciosDisponibles = mostrarSelectorProfesional
    ? (profesionalSeleccionado
        ? servicios.filter(s => s.activo && profesionalSeleccionado.servicios.some(ps => ps.id === s.id))
        : [])
    : servicios.filter(s => s.activo);

  // El choque de horario/repetición de servicio está escopeado por
  // profesional en el backend (dos profesionales pueden compartir horario) —
  // hay que espejar ese escope acá para que la validación previa no marque
  // como ocupado un horario que en realidad pertenece a otra profesional.
  const turnosDelDiaParaValidar = mostrarSelectorProfesional && selectedProfesionalId
    ? turnos.filter(t => t.profesional_id === selectedProfesionalId)
    : turnos;

  const handleConfirmar = async () => {
    if (!selectedCliente || selectedServicioIds.length === 0) return;
    if (mostrarSelectorProfesional && !selectedProfesionalId) return;

    const hora = `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`;
    const errorValidacion = validarTurno({
      fecha,
      hora,
      clienteId: selectedCliente.id,
      servicioIds: selectedServicioIds,
      servicios,
      turnosDelDia: turnosDelDiaParaValidar,
      slots,
      aplicarMaxPorCliente: true,
    });
    if (errorValidacion) {
      await alertDialog(errorValidacion);
      return;
    }

    setSaving(true);
    const result = await crearTurno({
      cliente_id:   selectedCliente.id,
      servicio_ids: selectedServicioIds,
      fecha_hora:   `${fecha} ${hora}`,
      ...(mostrarSelectorProfesional && selectedProfesionalId
        ? { profesional_id: selectedProfesionalId }
        : {}),
    });
    setSaving(false);
    if (result.success) router.back();
    else await alertDialog(result.message ?? t('createError'));
  };

  const clientesFiltrados = clientes.filter(c =>
    c.activo && `${c.nombre} ${c.apellido}`.toLowerCase().includes(clienteBuscar.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>{t('title')}</h1>
      </div>

      {/* Banner */}
      <div style={{ padding: '8px 20px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.primary, letterSpacing: 0.5, margin: 0, textTransform: 'uppercase' }}>
          {t('selectedDay', { fecha: formatFechaLarga(fecha) })}
        </p>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ─── CLIENTE ─── */}
        <p style={sectionLabelStyle}>{t('client')}</p>
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <div
            onClick={() => setShowClienteDropdown(prev => !prev)}
            style={{
              ...inputStyle,
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              borderRadius: showClienteDropdown ? '12px 12px 0 0' : 12,
              borderColor: showClienteDropdown ? colors.primary : colors.border,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span style={{ flex: 1, color: selectedCliente ? colors.text : colors.placeholder, fontSize: 15 }}>
              {selectedCliente ? `${selectedCliente.nombre} ${selectedCliente.apellido}` : t('select')}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="2"
              style={{ transform: showClienteDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {showClienteDropdown && (
            <div style={{
              border: `1px solid ${colors.border}`, borderTop: 'none',
              borderRadius: '0 0 12px 12px', backgroundColor: colors.surface,
              maxHeight: 220, overflowY: 'auto',
            }}>
              <input
                autoFocus
                placeholder={t('searchByName')}
                value={clienteBuscar}
                onChange={e => setClienteBuscar(e.target.value)}
                style={{
                  padding: '10px 14px', border: 'none', borderBottom: `1px solid ${colors.border}`,
                  width: '100%', boxSizing: 'border-box', outline: 'none', fontSize: 14,
                }}
              />
              {clientesFiltrados.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedCliente(c); setShowClienteDropdown(false); setClienteBuscar(''); }}
                  style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 15, color: colors.text, borderBottom: `1px solid ${colors.border}` }}
                >
                  {c.nombre} {c.apellido}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── PROFESIONAL ─── (invisible con ≤1 profesional activa) */}
        {mostrarSelectorProfesional && (
          <>
            <p style={sectionLabelStyle}>{t('professional')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {activeProfesionales.map(p => {
                const selected = selectedProfesionalId === p.id;
                const color = p.color || colors.primary;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSeleccionarProfesional(p.id)}
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
          </>
        )}

        {/* ─── SERVICIOS ─── */}
        <p style={sectionLabelStyle}>{t('services')}</p>
        {mostrarSelectorProfesional && !profesionalSeleccionado ? (
          <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 20px 2px' }}>
            {t('chooseProfessionalFirst')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {serviciosDisponibles.length === 0 ? (
              <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                {t('noServicesAssigned')}
              </p>
            ) : serviciosDisponibles.map(s => (
              <button
                key={s.id}
                onClick={() => toggleServicio(s.id)}
                style={{
                  borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  border: `1px solid ${selectedServicioIds.includes(s.id) ? colors.primary : colors.divider}`,
                  backgroundColor: selectedServicioIds.includes(s.id) ? colors.primary : colors.surface,
                  color: selectedServicioIds.includes(s.id) ? '#FFF' : colors.text,
                }}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}

        {/* ─── HORA DEL TURNO ─── */}
        <p style={sectionLabelStyle}>{t('appointmentTime')}</p>
        <div
          onClick={() => { setTempHora(horaSeleccionada); setShowHoraPicker(true); }}
          style={{ ...inputStyle, cursor: 'pointer', marginBottom: 32 }}
        >
          {formatHora12(`${horaSeleccionada.hora}:${horaSeleccionada.minuto}`)}
        </div>

        {/* ─── Submit ─── */}
        <button
          onClick={handleConfirmar}
          disabled={
            saving || !selectedCliente || selectedServicioIds.length === 0 ||
            (mostrarSelectorProfesional && !selectedProfesionalId)
          }
          style={{
            width: '100%', height: 52, borderRadius: 14,
            backgroundColor: colors.primary, color: '#fff',
            fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
            opacity: (
              !selectedCliente || selectedServicioIds.length === 0 ||
              (mostrarSelectorProfesional && !selectedProfesionalId)
            ) ? 0.5 : 1,
          }}
        >
          {saving ? t('saving') : t('confirmAppointment')}
        </button>
      </div>

      {/* ─── Hora Picker modal ─── */}
      {showHoraPicker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: colors.surface, borderRadius: '20px 20px 0 0',
            padding: 24, paddingBottom: 48,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.divider, margin: '0 auto 16px' }} />
            <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, marginBottom: 16, color: colors.text }}>
              {t('timeModalTitle')}
            </p>
            <DrumPicker
              columns={[
                { name: 'hora',   items: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')) },
                { name: 'minuto', items: Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')) },
              ]}
              value={tempHora}
              onChange={setTempHora}
            />
            <button
              onClick={() => { setHoraSeleccionada(tempHora); setShowHoraPicker(false); }}
              style={{
                marginTop: 24, width: '100%', height: 52, borderRadius: 14,
                backgroundColor: colors.primary, color: '#fff',
                fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Default export — wraps in Suspense for useSearchParams
// ─────────────────────────────────────────────
export default function NuevoTurnoPage() {
  const t = useTranslations('agenda.NuevoTurnoPage');
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: colors.subtext }}>{t('loading')}</div>}>
      <NuevoTurnoContent />
    </Suspense>
  );
}
