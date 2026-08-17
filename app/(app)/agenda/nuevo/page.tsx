'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronDown, User, CheckCircle2 } from 'lucide-react';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';
import { ServicioPicker } from '@/components/agenda/ServicioPicker';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { Cliente } from '@/services/clienteService';
import { DrumPicker } from '@/components/DrumPicker';
import { validarTurno } from '@/lib/turnoValidaciones';
import { alertDialog } from '@/store/useConfirmStore';
import { formatFecha, fechaDeHoy } from '@/lib/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { whatsappHelper } from '@/lib/whatsappHelper';

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
  fontSize: 11, fontWeight: 700, color: colors.muted, letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.border}`,
  borderRadius: 12, padding: '14px 16px', fontSize: 15, color: colors.text,
};

// ─────────────────────────────────────────────
// Inner component (uses useSearchParams)
// ─────────────────────────────────────────────
function NuevoTurnoContent() {
  const router       = useRouter();
  const t            = useTranslations('agenda.NuevoTurnoPage');
  const searchParams = useSearchParams();
  const today        = fechaDeHoy();
  const fecha        = searchParams.get('fecha') ?? today;

  const { crearTurno, turnos, fetchTurnos }  = useTurnoStore();
  const { servicios, fetchServicios }        = useServiciosStore();
  const { clientes, fetchClientes }          = useClientesStore();
  const { slots, fetchSlots }                = useSlotsStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { requiereEnvioManualWhatsapp }      = useAuth();
  const { obtenerContenido }                 = useWhatsappTemplates();

  const [selectedCliente,      setSelectedCliente]      = useState<Cliente | null>(null);
  const [selectedServicioIds,  setSelectedServicioIds]  = useState<number[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [showClienteDropdown,  setShowClienteDropdown]  = useState(false);
  const [clienteBuscar,        setClienteBuscar]        = useState('');
  const [showHoraPicker,       setShowHoraPicker]       = useState(false);
  const [saving,               setSaving]               = useState(false);
  const [turnoCreado, setTurnoCreado] = useState<{
    cliente: Cliente;
    servicios: string;
    profesional?: string;
  } | null>(null);

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
    if (!result.success) {
      await alertDialog(result.message ?? t('createError'));
      return;
    }

    if (requiereEnvioManualWhatsapp && selectedCliente.telefono) {
      const nombresServicios = servicios
        .filter(s => selectedServicioIds.includes(s.id))
        .map(s => s.nombre)
        .join(' + ');
      setTurnoCreado({
        cliente: selectedCliente,
        servicios: nombresServicios,
        profesional: mostrarSelectorProfesional ? (profesionalSeleccionado?.nombre ?? undefined) : undefined,
      });
    } else {
      router.back();
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    c.activo && `${c.nombre} ${c.apellido}`.toLowerCase().includes(clienteBuscar.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 4px' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: -4, display: 'flex', color: colors.text }}
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: colors.primaryDeep, letterSpacing: 1.5,
          textTransform: 'uppercase', margin: '0 0 4px',
        }}>
          {t('selectedDay', { fecha: formatFechaLarga(fecha) })}
        </p>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
      </div>

      {turnoCreado ? (
        <div style={{ padding: '0 20px' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
            padding: '32px 20px', marginBottom: 20, borderRadius: 24, backgroundColor: colors.successBg,
          }}>
            <CheckCircle2 size={36} color={colors.success} strokeWidth={1.75} />
            <h2 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 22, color: colors.textStrong, margin: '4px 0 0' }}>
              {t('appointmentCreatedTitle')}
            </h2>
            <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
              {t('manualConfirmationNotice')}
            </p>
          </div>
          <a
            href={whatsappHelper.buildUrl({
              clienteNombre:   turnoCreado.cliente.nombre,
              clienteApellido: turnoCreado.cliente.apellido,
              clienteTelefono: turnoCreado.cliente.telefono!,
              servicio:        turnoCreado.servicios,
              fecha,
              hora:            `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`,
              plantilla:       obtenerContenido('confirmacion'),
              profesional:     turnoCreado.profesional,
            })}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', height: 52, borderRadius: 14, marginBottom: 12,
              backgroundColor: colors.whatsapp, color: colors.primaryFg, textDecoration: 'none',
              fontSize: 15, fontWeight: 700, boxSizing: 'border-box',
            }}
          >
            <WhatsappGlyph size={18} />
            {t('sendConfirmationWhatsapp')}
          </a>
          <button
            onClick={() => router.back()}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              backgroundColor: 'transparent', color: colors.text,
              border: `1px solid ${colors.border}`,
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {t('readyButton')}
          </button>
        </div>
      ) : (
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
            <User size={18} strokeWidth={1.8} color={colors.muted} />
            <span style={{ flex: 1, color: selectedCliente ? colors.text : colors.placeholder, fontSize: 15 }}>
              {selectedCliente ? `${selectedCliente.nombre} ${selectedCliente.apellido}` : t('select')}
            </span>
            <ChevronDown
              size={16} strokeWidth={2} color={colors.muted}
              style={{ transform: showClienteDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            />
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
                  backgroundColor: 'transparent', color: colors.text,
                }}
              />
              {clientesFiltrados.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedCliente(c); setShowClienteDropdown(false); setClienteBuscar(''); }}
                  style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 15, color: colors.text, borderBottom: `1px solid ${colors.hairline}` }}
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
                      borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${selected ? color : colors.border}`,
                      backgroundColor: selected ? color : colors.surface,
                      color: selected ? colors.primaryFg : colors.text,
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      backgroundColor: selected ? colors.primaryFg : color,
                    }} />
                    {p.nombre}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ─── SERVICIOS ─── */}
        <ServicioPicker
          t={t}
          mostrarSelectorProfesional={mostrarSelectorProfesional}
          hayProfesionalSeleccionada={!!profesionalSeleccionado}
          serviciosDisponibles={serviciosDisponibles}
          selectedServicioIds={selectedServicioIds}
          onToggleServicio={toggleServicio}
        />

        {/* ─── HORA DEL TURNO ─── */}
        <p style={sectionLabelStyle}>{t('appointmentTime')}</p>
        <div
          onClick={() => { setTempHora(horaSeleccionada); setShowHoraPicker(true); }}
          style={{ ...inputStyle, fontFamily: agendaFontSerif, fontSize: 18, cursor: 'pointer', marginBottom: 32 }}
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
            backgroundColor: colors.primary, color: colors.primaryFg,
            fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: (
              !selectedCliente || selectedServicioIds.length === 0 ||
              (mostrarSelectorProfesional && !selectedProfesionalId)
            ) ? 0.5 : 1,
          }}
        >
          {saving ? t('saving') : t('confirmAppointment')}
        </button>
      </div>
      )}

      {/* ─── Hora Picker modal ─── */}
      {showHoraPicker && (
        <div
          onClick={() => setShowHoraPicker(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: colors.surface, borderRadius: '24px 24px 0 0',
              boxShadow: shadows.sheet, padding: 24, paddingBottom: 48,
            }}
          >
            <p style={{ textAlign: 'center', fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 19, marginBottom: 16, color: colors.textStrong }}>
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
                backgroundColor: colors.primary, color: colors.primaryFg,
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
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
