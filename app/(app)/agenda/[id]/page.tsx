'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { Cliente } from '@/services/clienteService';
import { DrumPicker } from '@/components/DrumPicker';
import { validarTurno } from '@/lib/turnoValidaciones';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatFechaLarga(fecha: string): string {
  const d     = new Date(fecha + 'T00:00:00');
  const dias  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${dias[d.getDay()]}, ${d.getDate()} De ${meses[d.getMonth()]}`;
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
  fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: '#FFF', border: '1px solid #EEE',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12,
  padding: '14px 16px', fontSize: 15, color: '#333',
};

// ─────────────────────────────────────────────
// EditarTurnoPage
// ─────────────────────────────────────────────
export default function EditarTurnoPage() {
  const router = useRouter();
  const params = useParams();
  const rawId  = params?.id;
  const turnoId = Number(Array.isArray(rawId) ? rawId[0] : rawId ?? '0');

  const { actualizarTurno, fetchTurno, turnoActual, loadingTurno, errorTurno, turnos, fetchTurnos } = useTurnoStore();
  const { servicios, fetchServicios }   = useServiciosStore();
  const { clientes, fetchClientes }     = useClientesStore();
  const { slots, fetchSlots }           = useSlotsStore();
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
    setSelectedProfesionalId(prev => prev === id ? null : id);
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

  const handleGuardar = async () => {
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
      excluirTurnoId: turnoId,
    });
    if (errorValidacion) {
      alert(errorValidacion);
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
    else alert(result.message ?? 'No se pudo actualizar el turno.');
  };

  const clientesFiltrados = clientes.filter(c =>
    c.activo && `${c.nombre} ${c.apellido}`.toLowerCase().includes(clienteBuscar.toLowerCase())
  );

  if (loadingTurno) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        Cargando turno...
      </div>
    );
  }

  if (errorTurno) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
        <p>{errorTurno}</p>
        <button
          onClick={() => router.back()}
          style={{
            marginTop: 16, fontSize: 14, fontWeight: 600, color: colors.primary,
            border: `1px solid ${colors.primary}`, borderRadius: 20,
            padding: '8px 16px', backgroundColor: 'transparent', cursor: 'pointer',
          }}
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 100 }}>

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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>Editar Turno</h1>
      </div>

      {/* Banner */}
      <div style={{ padding: '8px 20px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.primary, letterSpacing: 0.5, margin: 0, textTransform: 'uppercase' }}>
          EDITANDO TURNO: {fecha ? formatFechaLarga(fecha) : ''}
        </p>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ─── CLIENTE ─── */}
        <p style={sectionLabelStyle}>CLIENTE</p>
        <div style={{ marginBottom: 20, position: 'relative' }}>
          <div
            onClick={() => setShowClienteDropdown(prev => !prev)}
            style={{
              ...inputStyle,
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              borderRadius: showClienteDropdown ? '12px 12px 0 0' : 12,
              borderColor: showClienteDropdown ? colors.primary : '#EEE',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span style={{ flex: 1, color: selectedCliente ? colors.text : '#AAA', fontSize: 15 }}>
              {selectedCliente ? `${selectedCliente.nombre} ${selectedCliente.apellido}` : 'Seleccionar...'}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"
              style={{ transform: showClienteDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {showClienteDropdown && (
            <div style={{
              border: '1px solid #EEE', borderTop: 'none',
              borderRadius: '0 0 12px 12px', backgroundColor: '#fff',
              maxHeight: 220, overflowY: 'auto',
            }}>
              <input
                autoFocus
                placeholder="Buscar por nombre..."
                value={clienteBuscar}
                onChange={e => setClienteBuscar(e.target.value)}
                style={{
                  padding: '10px 14px', border: 'none', borderBottom: '1px solid #EEE',
                  width: '100%', boxSizing: 'border-box', outline: 'none', fontSize: 14,
                }}
              />
              {clientesFiltrados.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedCliente(c); setShowClienteDropdown(false); setClienteBuscar(''); }}
                  style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 15, color: colors.text, borderBottom: '1px solid #F5F5F5' }}
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
            <p style={sectionLabelStyle}>PROFESIONAL</p>
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
                      border: `1px solid ${selected ? color : '#DDD'}`,
                      backgroundColor: selected ? color : '#FFF',
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
        <p style={sectionLabelStyle}>SERVICIOS</p>
        {mostrarSelectorProfesional && !profesionalSeleccionado ? (
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 20px 2px' }}>
            Elegí una profesional para ver sus servicios.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {serviciosDisponibles.map(s => (
              <button
                key={s.id}
                onClick={() => toggleServicio(s.id)}
                style={{
                  borderRadius: 20, padding: '8px 16px', fontSize: 14, cursor: 'pointer',
                  border: `1px solid ${selectedServicioIds.includes(s.id) ? colors.primary : '#DDD'}`,
                  backgroundColor: selectedServicioIds.includes(s.id) ? colors.primary : '#FFF',
                  color: selectedServicioIds.includes(s.id) ? '#FFF' : colors.text,
                }}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}

        {/* ─── HORA DEL TURNO ─── */}
        <p style={sectionLabelStyle}>HORA DEL TURNO</p>
        <div
          onClick={() => { setTempHora(horaSeleccionada); setShowHoraPicker(true); }}
          style={{ ...inputStyle, cursor: 'pointer', marginBottom: 32 }}
        >
          {formatHora12(`${horaSeleccionada.hora}:${horaSeleccionada.minuto}`)}
        </div>

        {/* ─── Submit ─── */}
        <button
          onClick={handleGuardar}
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
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {/* ─── Hora Picker modal ─── */}
      {showHoraPicker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 60 }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: '#fff', borderRadius: '20px 20px 0 0',
            padding: 24, paddingBottom: 48,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', margin: '0 auto 16px' }} />
            <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, marginBottom: 16, color: colors.text }}>
              Hora del turno
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
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
