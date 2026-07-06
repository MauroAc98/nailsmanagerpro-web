'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { colors } from '@/theme/colors';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { Turno, TurnoMes } from '@/services/turnoService';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SWIPE_REVEAL    = 80;
const SWIPE_THRESHOLD = 55;

const DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fechaDeHora(fechaHora: string): string {
  return fechaHora.slice(0, 10); // "YYYY-MM-DD"
}

function horaDeHora(fechaHora: string): string {
  return fechaHora.slice(11, 16); // "HH:MM"
}

function formatFechaMini(fechaHora: string): string {
  const dateStr = fechaDeHora(fechaHora);
  const parts   = dateStr.split('-');
  const mm      = parts[1];
  const dd      = parts[2];
  const d       = new Date(dateStr + 'T00:00:00');
  return `${DAYS[d.getDay()]} ${dd}/${mm}`;
}

function formatCellDate(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────
// Style constants
// ─────────────────────────────────────────────
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#AAA', letterSpacing: 1,
  textTransform: 'uppercase', marginBottom: 8,
};

// ─────────────────────────────────────────────
// SwipeableTurnoCard — PENDIENTE and EN_CURSO
// ─────────────────────────────────────────────
function SwipeableTurnoCard({
  turno,
  onCancel,
  onFinalizar,
  onPress,
}: {
  turno:        Turno;
  onCancel:     () => void;
  onFinalizar?: () => void;
  onPress?:     () => void;
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
    startX.current     = e.touches[0].clientX;
    initOffset.current = liveOffset.current;
    dragged.current    = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta   = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 5) dragged.current = true;
    const clamped = Math.min(0, Math.max(-SWIPE_REVEAL, initOffset.current + delta));
    liveOffset.current = clamped;
    applyTransform(clamped, false);
  };

  const handleTouchEnd = () => {
    snapTo(liveOffset.current < -SWIPE_THRESHOLD ? -SWIPE_REVEAL : 0);
  };

  const handleCardClick = () => {
    if (dragged.current) return;
    if (liveOffset.current < -10) { snapTo(0); return; }
    onPress?.();
  };

  const isEnCurso = turno.estado_visual === 'en_curso';

  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>

      {/* CANCELAR panel behind */}
      <div
        onClick={onCancel}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: SWIPE_REVEAL,
          backgroundColor: '#FFADAD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8B0000', letterSpacing: 0.5 }}>
          CANCELAR
        </span>
      </div>

      {/* Swipeable card */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
        style={{
          backgroundColor: '#FFF',
          borderRadius: 14,
          border: '1px solid #EEE',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          transform: 'translateX(0)',
        }}
      >
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: colors.primary, minWidth: 48 }}>
            {horaDeHora(turno.fecha_hora)}
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: colors.text }}>
            {turno.cliente ? `${turno.cliente.nombre} ${turno.cliente.apellido}` : 'Clienta eliminada'}
          </span>

          {isEnCurso ? (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#E07000',
              border: '1px solid #E07000', borderRadius: 12,
              padding: '3px 8px', whiteSpace: 'nowrap',
            }}>
              ● EN CURSO
            </span>
          ) : (
            <>
              {turno.cliente?.telefono && (
                <a
                  href={`https://wa.me/${turno.cliente.telefono.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', color: '#25D366' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </>
          )}
        </div>

        {/* Row 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, color: '#999' }}>{formatFechaMini(turno.fecha_hora)}</span>
          <span style={{ fontSize: 12, color: '#999' }}>•</span>
          <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>{turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + ')}</span>
        </div>

        {/* Row 3: Finalizar ahora (EN_CURSO only) */}
        {isEnCurso && onFinalizar && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={e => { e.stopPropagation(); onFinalizar(); }}
              style={{
                fontSize: 13, fontWeight: 600, color: colors.primary,
                border: `1px solid ${colors.primary}`, borderRadius: 20,
                padding: '6px 14px', backgroundColor: 'transparent', cursor: 'pointer',
              }}
            >
              Finalizar ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FinalizadoCard — opacity 0.6, no swipe
// ─────────────────────────────────────────────
function FinalizadoCard({ turno }: { turno: Turno }) {
  return (
    <div style={{ opacity: 0.6 }}>
      <div style={{
        backgroundColor: '#FFF', borderRadius: 14,
        border: '1px solid #EEE', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        padding: '14px 16px',
      }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: colors.primary, minWidth: 48 }}>
            {horaDeHora(turno.fecha_hora)}
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: colors.text }}>
            {turno.cliente ? `${turno.cliente.nombre} ${turno.cliente.apellido}` : 'Clienta eliminada'}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#999',
            border: '1px solid #CCC', borderRadius: 12,
            padding: '3px 8px', whiteSpace: 'nowrap',
          }}>
            ✓ FINALIZADO
          </span>
        </div>
        {/* Row 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, color: '#999' }}>{formatFechaMini(turno.fecha_hora)}</span>
          <span style={{ fontSize: 12, color: '#999' }}>•</span>
          <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>{turno.servicios.filter(s => s != null).map(s => s.nombre).join(' + ')}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CalendarioMensual — pure JS, no library
// ─────────────────────────────────────────────
function CalendarioMensual({
  viewDate,
  onMonthChange,
  fechaSeleccionada,
  turnosMes,
  selectedDayCount,
  onDayClick,
}: {
  viewDate:         Date;
  onMonthChange:    (d: Date) => void;
  fechaSeleccionada: string;
  turnosMes:        TurnoMes[];
  selectedDayCount: number;
  onDayClick:       (fecha: string) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const turnosSet = new Set(turnosMes.map(t => t.fecha));

  // Build 42-cell grid (6 rows × 7 cols)
  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - firstDayOfMonth + 1 + i),
      isCurrentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (cells.length < 42) {
    const nextDay = cells.length - firstDayOfMonth - daysInMonth + 1;
    cells.push({ date: new Date(year, month + 1, nextDay), isCurrentMonth: false });
  }

  return (
    <div style={{ padding: '0 16px 12px' }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: 18, color: colors.text }}
        >
          ◄
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: 18, color: colors.text }}
        >
          ►
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#AAA', paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((cell, idx) => {
          const cellStr    = formatCellDate(cell.date);
          const isSelected = cellStr === fechaSeleccionada;
          const isToday    = cellStr === todayStr;
          const hasTurnos  = turnosSet.has(cellStr);

          return (
            <div
              key={idx}
              onClick={() => onDayClick(cellStr)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', cursor: 'pointer' }}
            >
              {/* Circle */}
              <div style={{
                width: 32, height: 32, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? colors.primary : 'transparent',
                border: isToday && !isSelected ? `1px solid ${colors.primary}` : 'none',
                position: 'relative',
              }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: isSelected ? 700 : 400,
                  color: isSelected ? '#FFF' : cell.isCurrentMonth ? colors.text : '#CCC',
                }}>
                  {cell.date.getDate()}
                </span>
                {/* Badge for selected day */}
                {isSelected && selectedDayCount > 0 && (
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 16, height: 16, borderRadius: 8,
                    backgroundColor: '#E07000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#FFF' }}>
                      {selectedDayCount}
                    </span>
                  </div>
                )}
              </div>
              {/* Appointment dot */}
              {hasTurnos
                ? <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 2 }} />
                : <div style={{ height: 10 }} />
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// AgendaPage
// ─────────────────────────────────────────────
export default function AgendaPage() {
  const router = useRouter();

  const {
    turnos, turnosMes, loading,
    fechaSeleccionada, fetchTurnos, fetchTurnosMes,
    completarTurno, cancelarTurno, setFechaSeleccionada,
  } = useTurnoStore();

  const { servicios, fetchServicios } = useServiciosStore();

  const [showFiltro,       setShowFiltro]       = useState(false);
  const [filtroCliente,    setFiltroCliente]    = useState('');
  const [filtroServicioId, setFiltroServicioId] = useState<number | null>(null);
  const [viewDate,         setViewDate]         = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  // Mount: load today's data
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFechaSeleccionada(today);
    fetchTurnos(today);
    fetchTurnosMes(today.slice(0, 7));
    if (servicios.length === 0) fetchServicios();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthChange = useCallback((newDate: Date) => {
    setViewDate(newDate);
    const y   = newDate.getFullYear();
    const m   = newDate.getMonth();
    const mes = `${y}-${String(m + 1).padStart(2, '0')}`;
    fetchTurnosMes(mes);

    const today        = new Date();
    const isSameMonth  = today.getFullYear() === y && today.getMonth() === m;
    const newFecha     = isSameMonth
      ? today.toISOString().split('T')[0]
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    setFechaSeleccionada(newFecha);
    fetchTurnos(newFecha);
  }, [fetchTurnos, fetchTurnosMes, setFechaSeleccionada]);

  const handleDayClick = useCallback((fecha: string) => {
    const parts     = fecha.split('-');
    const y         = Number(parts[0]);
    const m         = Number(parts[1]);
    const cellMonth = m - 1;

    if (cellMonth !== viewDate.getMonth() || y !== viewDate.getFullYear()) {
      setViewDate(new Date(y, cellMonth, 1));
      fetchTurnosMes(`${y}-${String(m).padStart(2, '0')}`);
    }

    setFechaSeleccionada(fecha);
    fetchTurnos(fecha);
  }, [viewDate, fetchTurnos, fetchTurnosMes, setFechaSeleccionada]);

  const handleFinalizar = async (id: number) => {
    const result = await completarTurno(id);
    if (!result.success) alert(result.message ?? 'No se pudo finalizar el turno.');
  };

  const handleCancelar = async (id: number) => {
    if (!confirm('¿Cancelar este turno?')) return;
    const result = await cancelarTurno(id);
    if (!result.success) alert(result.message ?? 'No se pudo cancelar el turno.');
  };

  // Client-side filtering
  const turnosFiltrados = turnos
    .filter(t => t.estado !== 'cancelado')
    .filter(t => {
      if (!filtroCliente.trim()) return true;
      const q = filtroCliente.toLowerCase();
      return `${t.cliente.nombre} ${t.cliente.apellido}`.toLowerCase().includes(q);
    })
    .filter(t => {
      if (filtroServicioId === null) return true;
      return t.servicios.some(s => s.id === filtroServicioId);
    });

  const visibleCount = turnos.filter(t => t.estado !== 'cancelado').length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>Mi Agenda</h1>
        <button
          onClick={() => router.push(`/agenda/historia?fecha=${fechaSeleccionada}`)}
          style={{
            fontSize: 13, fontWeight: 600, color: colors.primary,
            border: `1px solid ${colors.primary}`, borderRadius: 20,
            padding: '6px 14px', backgroundColor: 'transparent', cursor: 'pointer',
          }}>
          Compartir
        </button>
      </div>

      {/* Calendar */}
      <CalendarioMensual
        viewDate={viewDate}
        onMonthChange={handleMonthChange}
        fechaSeleccionada={fechaSeleccionada}
        turnosMes={turnosMes}
        selectedDayCount={visibleCount}
        onDayClick={handleDayClick}
      />

      {/* Turnos section header */}
      <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>Turnos del día</p>
        <button
          onClick={() => setShowFiltro(true)}
          style={{
            fontSize: 13, fontWeight: 600, color: colors.text,
            border: '1px solid #DDD', borderRadius: 20,
            padding: '6px 14px', backgroundColor: 'transparent', cursor: 'pointer',
          }}
        >
          ≡ Filtrar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: 15 }}>Cargando turnos...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && turnosFiltrados.length === 0 && (
        <p style={{ textAlign: 'center', marginTop: 50, color: '#999', fontSize: 15 }}>
          No hay turnos para este día.
        </p>
      )}

      {/* Turnos list */}
      {!loading && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {turnosFiltrados.map(turno => {
            if (turno.estado === 'completado') {
              return <FinalizadoCard key={turno.id} turno={turno} />;
            }
            return (
              <SwipeableTurnoCard
                key={turno.id}
                turno={turno}
                onCancel={() => handleCancelar(turno.id)}
                onFinalizar={turno.estado_visual === 'en_curso' ? () => handleFinalizar(turno.id) : undefined}
                onPress={() => router.push(`/agenda/${turno.id}`)}
              />
            );
          })}
        </div>
      )}

      {/* Filter modal */}
      {showFiltro && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 }}
          onClick={() => setShowFiltro(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: '#fff', borderRadius: '20px 20px 0 0',
              padding: 24, paddingBottom: 48,
            }}
          >
            {/* Drag handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', margin: '0 auto 20px' }} />

            <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: '0 0 20px' }}>Filtros</p>

            {/* BUSCAR CLIENTE */}
            <p style={sectionLabelStyle}>BUSCAR CLIENTE</p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              backgroundColor: '#FFF', border: '1px solid #EEE',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12,
              paddingLeft: 14, paddingRight: 14, height: 48, marginBottom: 20,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="Nombre del cliente..."
                value={filtroCliente}
                onChange={e => setFiltroCliente(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: colors.text, background: 'transparent' }}
              />
            </div>

            {/* FILTRAR POR SERVICIO */}
            <p style={sectionLabelStyle}>FILTRAR POR SERVICIO</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {servicios.filter(s => s.activo).map(s => (
                <button
                  key={s.id}
                  onClick={() => setFiltroServicioId(filtroServicioId === s.id ? null : s.id)}
                  style={{
                    borderRadius: 20, padding: '8px 14px', fontSize: 13,
                    border: `1px solid ${filtroServicioId === s.id ? colors.primary : '#DDD'}`,
                    backgroundColor: filtroServicioId === s.id ? colors.primary : '#FFF',
                    color: filtroServicioId === s.id ? '#FFF' : colors.text,
                    cursor: 'pointer',
                  }}
                >
                  {s.nombre}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFiltro(false)}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                backgroundColor: colors.primary, color: '#fff',
                fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
              }}
            >
              Ver resultados
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push(`/agenda/nuevo?fecha=${fechaSeleccionada}`)}
        style={{
          position: 'fixed', bottom: 86, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.primary, border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(215, 158, 164, 0.5)', zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
