'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, User } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
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
import { formatFecha } from '@/lib/dateFormat';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatFechaLarga(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00');
  return formatFecha(d, 'diaSemanaFechaMes');
}

// Ignora acentos al comparar ("jose" matchea "José") — sin esto una
// búsqueda sin tilde no encontraba clientes con nombres acentuados.
function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
// EditarTurnoPage
// ─────────────────────────────────────────────
export default function EditarTurnoPage() {
  const router = useRouter();
  const t = useTranslations('agenda.EditarTurnoPage');
  const params = useParams();
  const rawId  = params?.id;
  const turnoId = Number(Array.isArray(rawId) ? rawId[0] : rawId ?? '0');

  const { actualizarTurno, fetchTurno, turnoActual, loadingTurno, errorTurno, turnos, fetchTurnos } = useTurnoStore();
  const { servicios, fetchServicios }   = useServiciosStore();
  const { clientes, fetchClientes, loading: clientesLoading, error: clientesError } = useClientesStore();
  const { slots, fetchSlots, loading: slotsLoading, ultimoProfesionalIdSolicitado } = useSlotsStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();

  const [fecha,               setFecha]               = useState('');
  const [turnoClienteId,      setTurnoClienteId]      = useState<number | null>(null);
  const [selectedCliente,     setSelectedCliente]     = useState<Cliente | null>(null);
  const [selectedServicioIds, setSelectedServicioIds] = useState<number[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [clienteBuscar,       setClienteBuscar]       = useState('');
  const [showHoraPicker,      setShowHoraPicker]      = useState(false);
  const [saving,              setSaving]              = useState(false);

  const now      = new Date();
  const initialH = String(now.getHours()).padStart(2, '0');
  const [horaSeleccionada, setHoraSeleccionada] = useState<Record<string, string>>({ hora: initialH, minuto: '00' });
  const [tempHora,         setTempHora]         = useState<Record<string, string>>({ hora: initialH, minuto: '00' });

  // Load turno and store data on mount
  useEffect(() => {
    if (clientes.length === 0) fetchClientes();
    if (servicios.length === 0) fetchServicios();
    if (slots.length === 0) fetchSlots();
    if (profesionales.length === 0) fetchProfesionales();
    fetchTurno(turnoId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate the form once the turno arrives from the store
  useEffect(() => {
    if (!turnoActual) return;
    const dateStr = turnoActual.fecha_hora.slice(0, 10);
    const timeStr = turnoActual.fecha_hora.slice(11, 16);
    const [h, m]  = timeStr.split(':');
    setFecha(dateStr);
    setSelectedServicioIds(turnoActual.servicios.filter(s => s != null).map(s => s.id));
    setHoraSeleccionada({ hora: h, minuto: m });
    setTempHora({ hora: h, minuto: m });
    setTurnoClienteId(turnoActual.cliente_id);
    // Preserva la profesional ya asignada al turno — si se omite acá el
    // backend re-resolvería al default de la cuenta en cada edición.
    setSelectedProfesionalId(turnoActual.profesional_id ?? null);
    fetchTurnos(dateStr);
  }, [turnoActual]); // eslint-disable-line react-hooks/exhaustive-deps

  // Match cliente once both clientes and turnoClienteId are available
  useEffect(() => {
    if (turnoClienteId !== null && clientes.length > 0 && selectedCliente === null) {
      const found = clientes.find(c => c.id === turnoClienteId) ?? null;
      if (found) setSelectedCliente(found);
    }
  }, [turnoClienteId, clientes, selectedCliente]);

  // ─────────────────────────────────────────────
  // Multi-agenda — invisible para cuentas con ≤1 profesional activa.
  // ─────────────────────────────────────────────
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const profesionalSeleccionado    = activeProfesionales.find(p => p.id === selectedProfesionalId) ?? null;

  // Cada profesional tiene sus propias horas de atención. Cuando cambia la
  // profesional elegida en el paso PROFESIONAL, refetch de slots escopeado a
  // ella para que validarTurno (bloqueo de horarios) refleje sus horas
  // reales — mismo mecanismo que agenda/nuevo/page.tsx. Sin selector (≤1
  // profesional activa) esto nunca se dispara — el fetch inicial sin scope
  // del mount (arriba) queda intacto.
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
    const nuevoId = selectedProfesionalId === id ? null : id;
    setSelectedProfesionalId(nuevoId);

    // Cambio activo del usuario (a diferencia de la hidratación inicial del
    // turno, que preserva todo vía serviciosDisponibles) — acá sí podamos
    // los servicios tildados que la nueva profesional no ofrezca, para no
    // dejar guardable una combinación profesional/servicio inválida.
    const nuevaProfesional = nuevoId ? activeProfesionales.find(p => p.id === nuevoId) : null;
    if (nuevaProfesional) {
      setSelectedServicioIds(prev => prev.filter(sid => nuevaProfesional.servicios.some(ps => ps.id === sid)));
    }
  };

  // Con selector visible: solo se ofrecen los servicios de la profesional
  // elegida, pero sin descartar automáticamente los ya tildados del turno
  // original (para no perder datos existentes al solo abrir la pantalla).
  const serviciosDisponibles = mostrarSelectorProfesional
    ? (profesionalSeleccionado
        ? servicios.filter(s => s.activo &&
            (profesionalSeleccionado.servicios.some(ps => ps.id === s.id) || selectedServicioIds.includes(s.id)))
        : servicios.filter(s => s.activo && selectedServicioIds.includes(s.id)))
    : servicios.filter(s => s.activo);

  // Mismo escope por profesional que en agenda/nuevo — ver comentario ahí.
  const turnosDelDiaParaValidar = mostrarSelectorProfesional && selectedProfesionalId
    ? turnos.filter(t => t.profesional_id === selectedProfesionalId)
    : turnos;

  // Mismo criterio que agenda/nuevo — ver comentario ahí. `slots` es un
  // store global compartido; si el usuario confirma antes de que resuelva
  // el fetchSlots(selectedProfesionalId) disparado al cambiar de
  // profesional, la validación de horario de atención correría contra los
  // slots de la profesional anterior.
  const slotsDesactualizados = mostrarSelectorProfesional && selectedProfesionalId != null
    && (ultimoProfesionalIdSolicitado !== selectedProfesionalId || slotsLoading);

  const handleGuardar = async () => {
    if (!selectedCliente || selectedServicioIds.length === 0) return;
    if (mostrarSelectorProfesional && !selectedProfesionalId) return;
    if (slotsDesactualizados) return;

    const hora = `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`;
    const errorValidacion = validarTurno({
      fecha,
      hora,
      clienteId: selectedCliente.id,
      servicioIds: selectedServicioIds,
      servicios,
      turnosDelDia: turnosDelDiaParaValidar,
      slots,
      excluirTurnoId: turnoId,
    });
    if (errorValidacion) {
      await alertDialog(errorValidacion);
      return;
    }

    setSaving(true);
    const result = await actualizarTurno(turnoId, {
      cliente_id:   selectedCliente.id,
      servicio_ids: selectedServicioIds,
      fecha_hora:   `${fecha} ${hora}`,
      // Se envía siempre que haya una profesional cargada (precargada desde
      // turnoActual.profesional_id, ver efecto más arriba), sin depender de
      // mostrarSelectorProfesional — si esa condición gatillara el envío,
      // una profesional asignada que quedó fuera del set "activo" (o una
      // cuenta que bajó a ≤1 activa) haría que el PUT omita profesional_id
      // y el backend reasigne el turno a la profesional default de la cuenta.
      ...(selectedProfesionalId ? { profesional_id: selectedProfesionalId } : {}),
    });
    setSaving(false);
    if (result.success) router.back();
    else await alertDialog(result.message ?? t('updateError'));
  };

  const clientesFiltrados = clientes.filter(c =>
    c.activo && normalizarTexto(`${c.nombre} ${c.apellido}`).includes(normalizarTexto(clienteBuscar))
  );

  if (loadingTurno) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: 40, textAlign: 'center', color: colors.subtext }}>
        {t('loadingAppointment')}
      </div>
    );
  }

  if (errorTurno) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: 40, textAlign: 'center', color: colors.subtext }}>
        <p>{errorTurno}</p>
        <button
          onClick={() => router.back()}
          style={{
            marginTop: 16, fontSize: 14, fontWeight: 700, color: colors.primaryDeep,
            border: `1px solid ${colors.primaryDeep}`, borderRadius: 20,
            padding: '8px 16px', backgroundColor: 'transparent', cursor: 'pointer',
          }}
        >
          {t('back')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: colors.primaryDeep, letterSpacing: 1.5,
          textTransform: 'uppercase', margin: '0 0 4px',
        }}>
          {t('editingAppointment', { fecha: fecha ? formatFechaLarga(fecha) : '' })}
        </p>
        <h1 style={{ fontFamily: agendaFontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.15, color: colors.textStrong, margin: 0 }}>
          {t('title')}
        </h1>
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
              borderColor: showClienteDropdown ? colors.primaryDeep : colors.border,
            }}
          >
            <User size={18} strokeWidth={1.8} color={colors.muted} style={{ flexShrink: 0 }} />
            <span style={{
              flex: 1, minWidth: 0, color: selectedCliente ? colors.text : colors.placeholder, fontSize: 15,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {selectedCliente ? `${selectedCliente.nombre} ${selectedCliente.apellido}` : t('select')}
            </span>
            <ChevronDown
              size={16} strokeWidth={2} color={colors.muted}
              style={{ flexShrink: 0, transform: showClienteDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
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
              {clientesLoading && clientes.length === 0 && (
                <p style={{ padding: '14px', margin: 0, fontSize: 14, color: colors.subtext, textAlign: 'center' }}>
                  {t('loadingClients')}
                </p>
              )}
              {!clientesLoading && clientesError && clientes.length === 0 && (
                <div style={{ padding: '14px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 14, color: colors.dangerBorder }}>{clientesError}</p>
                  <button
                    onClick={() => fetchClientes()}
                    style={{
                      border: `1px solid ${colors.border}`, borderRadius: 10, padding: '6px 14px',
                      background: 'transparent', color: colors.text, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {t('retry')}
                  </button>
                </div>
              )}
              {!clientesLoading && !clientesError && clientes.length > 0 && clientesFiltrados.length === 0 && (
                <p style={{ padding: '14px', margin: 0, fontSize: 14, color: colors.subtext, textAlign: 'center' }}>
                  {t('noClientsFound')}
                </p>
              )}
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

        <p style={sectionLabelStyle}>{t('appointmentTime')}</p>
        <div
          onClick={() => { setTempHora(horaSeleccionada); setShowHoraPicker(true); }}
          style={{ ...inputStyle, fontFamily: agendaFontSerif, fontSize: 18, cursor: 'pointer', marginBottom: 32 }}
        >
          {formatHora12(`${horaSeleccionada.hora}:${horaSeleccionada.minuto}`)}
        </div>

        {/* ─── Submit ─── */}
        <button
          onClick={handleGuardar}
          disabled={
            saving || !selectedCliente || selectedServicioIds.length === 0 ||
            (mostrarSelectorProfesional && !selectedProfesionalId) || slotsDesactualizados
          }
          style={{
            width: '100%', height: 52, borderRadius: 14,
            backgroundColor: colors.primarySolid, color: colors.primaryFg,
            fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: (
              !selectedCliente || selectedServicioIds.length === 0 ||
              (mostrarSelectorProfesional && !selectedProfesionalId) || slotsDesactualizados
            ) ? 0.5 : 1,
          }}
        >
          {slotsDesactualizados ? t('loadingSchedule') : saving ? t('saving') : t('saveChanges')}
        </button>
      </div>

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
                backgroundColor: colors.primarySolid, color: colors.primaryFg,
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
