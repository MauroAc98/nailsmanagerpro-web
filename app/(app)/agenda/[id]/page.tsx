'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';
import { IdeaDelTurno } from '@/components/agenda/IdeaDelTurno';
import { BadgeReservaOnline } from '@/components/reservaOnline/BadgeReservaOnline';
import { reservaOnlineHabilitada } from '@/lib/reservaOnline/flag';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { FilaQueMostrar } from '@/components/filtros/FilaQueMostrar';
import { TarjetaQueMostrar } from '@/components/filtros/TarjetaQueMostrar';
import { ProfesionalSheet, SinProfesionalIcono } from '@/components/filtros/ProfesionalSheet';
import { SelectorServicios } from '@/components/SelectorServicios';
import { AltaClienteRapidaSheet, type AltaClienteRapidaHandle } from '@/components/clientes/AltaClienteRapidaSheet';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { Cliente } from '@/services/clienteService';
import { profesionalJefa } from '@/services/profesionalService';
import { DrumPicker } from '@/components/DrumPicker';
import { validarTurno } from '@/lib/turnoValidaciones';
import { advertenciaTurno } from '@/lib/turnoAdvertencias';
import { ClienteSelector } from '@/components/agenda/ClienteSelector';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import { resumenMovimiento, tramosPendientes } from '@/lib/gruposTurnos';
import { advertenciaDelCombo, tramosAMover } from '@/lib/comboManual';
import { showToast } from '@/store/useToastStore';
import { formatFecha } from '@/lib/dateFormat';
import { MontoFit } from '@/components/estadisticas/MontoFit';
import { formatMonto } from '@/lib/money';
import { filaDePago } from '@/lib/cobros';
import { usePendientesDeCobroStore } from '@/store/usePendientesDeCobroStore';
import { pedirPreciosServicios } from '@/store/usePrecioServiciosStore';
import { Spinner } from '@/components/Spinner';

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

const monto = (n: number) => `$${formatMonto(n)}`;

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

  const { actualizarTurno, reprogramarGrupo, fetchTurno, turnoActual, loadingTurno, errorTurno, turnos, fetchTurnos } = useTurnoStore();
  const { servicios, fetchServicios }   = useServiciosStore();
  const { slots, fetchSlots, loading: slotsLoading, ultimoProfesionalIdSolicitado } = useSlotsStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { bloqueos, fetchBloqueos } = useBloqueosAgendaStore();
  const { actualizarPrecios } = usePendientesDeCobroStore();

  const altaClienteRef = useRef<AltaClienteRapidaHandle>(null);

  const [fecha,               setFecha]               = useState('');
  const [selectedCliente,     setSelectedCliente]     = useState<Cliente | null>(null);
  const [selectedServicioIds, setSelectedServicioIds] = useState<number[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [profesionalAbierto, setProfesionalAbierto] = useState(false);
  const [showHoraPicker,      setShowHoraPicker]      = useState(false);
  const [saving,              setSaving]              = useState(false);
  // Turno de un combo: mover solo este turno (como siempre) o todo el combo. Fecha/hora del
  // combo = las del primer turno pendiente, hasta que la duena las cambie.
  const [alcanceHora, setAlcanceHora] = useState<'este' | 'combo'>('este');
  const [fechaCombo,  setFechaCombo]  = useState<string | null>(null);
  const [horaCombo,   setHoraCombo]   = useState<Record<string, string> | null>(null);

  const now      = new Date();
  const initialH = String(now.getHours()).padStart(2, '0');
  const [horaSeleccionada, setHoraSeleccionada] = useState<Record<string, string>>({ hora: initialH, minuto: '00' });
  const [tempHora,         setTempHora]         = useState<Record<string, string>>({ hora: initialH, minuto: '00' });

  // Load turno and store data on mount
  useEffect(() => {
    if (servicios.length === 0) fetchServicios();
    if (slots.length === 0) fetchSlots();
    if (profesionales.length === 0) fetchProfesionales();
    fetchTurno(turnoId);
    fetchBloqueos();
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
    // El cliente viene en la respuesta del turno: no hace falta cargar la lista
    // de clientes para encontrarlo. Solo se completa si todavía no hay uno
    // elegido (así una elección de la dueña no se pisa). cliente_id/cliente
    // pueden ser null si el cliente se eliminó.
    if (turnoActual.cliente_id != null && turnoActual.cliente) {
      const { nombre, apellido, telefono } = turnoActual.cliente;
      setSelectedCliente(prev => prev ?? {
        id: turnoActual.cliente_id, nombre, apellido, telefono: telefono ?? '', activo: true,
      });
    }
    // Preserva la profesional ya asignada al turno — si se omite acá el
    // backend re-resolvería al default de la cuenta en cada edición.
    setSelectedProfesionalId(turnoActual.profesional_id ?? null);
    fetchTurnos(dateStr);
  }, [turnoActual]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────
  // Multi-agenda — invisible para cuentas con ≤1 profesional activa.
  // ─────────────────────────────────────────────
  const activeProfesionales        = profesionales.filter(p => p.activo);
  const mostrarSelectorProfesional = activeProfesionales.length > 1;
  const profesionalSeleccionado    = activeProfesionales.find(p => p.id === selectedProfesionalId) ?? null;

  // Mismo criterio que agenda/nuevo — ver comentario ahí.
  const profesionalParaAdvertencia = mostrarSelectorProfesional
    ? profesionalSeleccionado
    : profesionalJefa(activeProfesionales);

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

  const pendientesCombo = turnoActual?.grupo_id != null
    ? [...tramosPendientes(turnoActual)].sort((a, b) => a.turno_id - b.turno_id)
    : [];
  const enCombo = alcanceHora === 'combo' && pendientesCombo.length > 0;
  const fechaComboEf = fechaCombo ?? pendientesCombo[0]?.fecha_hora.slice(0, 10) ?? '';
  const horaComboEf = horaCombo ?? {
    hora: pendientesCombo[0]?.fecha_hora.slice(11, 13) ?? '00', minuto: pendientesCombo[0]?.fecha_hora.slice(14, 16) ?? '00',
  };

  // Mueve el combo entero: el primer turno pendiente arranca en la fecha/hora elegida y los demas
  // conservan su desfasaje. La duena agenda a cualquier hora; el backend valida cada profesional.
  const handleMoverCombo = async () => {
    if (!turnoActual?.grupo_id || !enCombo) return;
    const nueva = `${horaComboEf.hora}:${horaComboEf.minuto}`;
    const advertencia = advertenciaDelCombo(tramosAMover(turnoActual, nueva), fechaComboEf, profesionales, bloqueos);
    if (advertencia && !(await confirmDialog(advertencia))) return;

    setSaving(true);
    const r = await reprogramarGrupo(turnoActual.grupo_id, `${fechaComboEf} ${nueva}`);
    setSaving(false);
    if (!r.success) {
      if (r.code === 'grupo_en_curso' || r.code === 'grupo_sin_pendientes') {
        await alertDialog(t(r.code === 'grupo_en_curso' ? 'comboEnCurso' : 'comboSinPendientes'));
        fetchTurno(turnoId);
      } else {
        await alertDialog(r.code === 'slot_held' ? t('comboSlotHeld') : (r.message ?? t('updateError')));
      }
      return;
    }
    showToast(t('comboMovido'));
    if (r.notificacion === 'omitida') await alertDialog(t('comboNoAvisado'));
    router.back();
  };

  // Bloque "Pago": misma derivación que la pantalla de Cobros (lib/cobros).
  const referencias = new Map(servicios.map(s => [s.id, s.precio]));
  // Solo con una seña online pagada: sin ella "Falta cobrar" repite el precio y no
  // informa nada. Lo cobrado de un turno finalizado se ve en Cobros.
  const filaPago = turnoActual ? filaDePago(turnoActual, referencias) : null;
  const pago = filaPago && filaPago.sena > 0 ? filaPago : null;

  const handleCargarPrecio = async () => {
    if (!turnoActual) return;
    const precios = await pedirPreciosServicios(
      turnoActual.servicios.map(s => {
        const ref = referencias.get(s.id);
        return { servicio_id: s.id, nombre: s.nombre, precioReferencia: ref != null && ref !== '' ? Number(ref) : null };
      }),
      {
        cliente: `${turnoActual.cliente.nombre} ${turnoActual.cliente.apellido}`.trim(),
        fechaHora: turnoActual.fecha_hora,
        modo: 'cargar',
      },
    );
    if (!precios) return;
    const result = await actualizarPrecios(turnoActual.id, precios);
    if (result.success) {
      showToast(t('pagoGuardado'));
      fetchTurno(turnoId, { silent: true });
    } else {
      await alertDialog(result.message ?? t('pagoGuardarError'));
    }
  };

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

    // Aviso NO bloqueante — ver comentario en agenda/nuevo.
    const duracionMinutosTurno = servicios
      .filter(s => selectedServicioIds.includes(s.id))
      .reduce((sum, s) => sum + s.duracion_minutos, 0);
    const advertencia = advertenciaTurno({
      fecha, hora, duracionMinutos: duracionMinutosTurno,
      profesional: profesionalParaAdvertencia, bloqueos,
    });
    if (advertencia) {
      const confirmado = await confirmDialog(advertencia);
      if (!confirmado) return;
    }

    // Turno de un grupo: solo se mueve este; se avisa cual se mueve y a que hora siguen los otros.
    const movimiento = turnoActual ? resumenMovimiento(turnoActual, `${fecha} ${hora}`) : null;

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
    if (result.success) {
      showToast(t('updated'));
      if (movimiento) {
        await alertDialog([
          t('soloSeMueve', { turno: movimiento.movido.nombre, hora: movimiento.movido.hora }),
          ...movimiento.quedan.map(q => t('sigueA', { nombre: q.nombre, hora: q.hora })),
        ].join(' '));
      }
      router.back();
    } else {
      await alertDialog(result.message ?? t('updateError'));
    }
  };


  if (loadingTurno) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Spinner label={t('loadingAppointment')} />
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
        {/* En la card de agenda el badge es solo un icono (compacto, ver
            SwipeableTurnoCard) para no comerle ancho al nombre — acá, donde
            sobra espacio, se ve el texto completo. */}
        {turnoActual?.origen === 'web' && reservaOnlineHabilitada() && (
          <div style={{ marginTop: 8 }}>
            <BadgeReservaOnline />
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Idea que el cliente escribio al reservar online (solo lectura). */}
        <IdeaDelTurno notas={turnoActual?.notas} origenWeb={turnoActual?.origen === 'web'} />

        {/* ─── PAGO ─── (solo lectura; misma regla que Cobros) */}
        {pago && (
          <div style={{ marginBottom: 20 }}>
            <p style={sectionLabelStyle}>{t('pagoTitle')}</p>
            <div style={{
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card,
              borderRadius: 14, padding: '4px 14px',
            }}>
              {(() => {
                const filas: { label: string; valor: string | null; destacado?: boolean }[] = [];
                if (pago.pago === 'sinprecio') {
                  filas.push({ label: t('pagoServicios'), valor: null });
                } else {
                  filas.push({ label: t('pagoServicios'), valor: pago.precio != null ? monto(pago.precio) : null });
                }
                if (pago.sena > 0) {
                  filas.push({ label: pago.senaCompartida ? t('pagoSenaGrupo') : t('pagoSena'), valor: monto(pago.sena) });
                }
                if (pago.finalizado && pago.pago !== 'sinprecio') {
                  filas.push({ label: t('pagoCobrado'), valor: monto(pago.cobrado ?? 0), destacado: true });
                } else if (!pago.finalizado && pago.faltaFila != null) {
                  filas.push({ label: t('pagoFalta'), valor: monto(pago.faltaFila), destacado: true });
                }
                return filas.map((f, i) => (
                  <div
                    key={f.label}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0',
                      borderTop: i === 0 ? 'none' : `1px solid ${colors.hairline}`,
                    }}
                  >
                    <span style={{ minWidth: 0, flex: 1, fontSize: 14, color: colors.subtext, fontWeight: f.destacado ? 700 : 500 }}>{f.label}</span>
                    {f.valor != null && (
                      <span style={{ flexShrink: 0, maxWidth: '60%', fontFamily: agendaFontSerif, color: colors.textStrong, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        <MontoFit maxFontSize={f.destacado ? 19 : 16} minFontSize={11}>{f.valor}</MontoFit>
                      </span>
                    )}
                  </div>
                ));
              })()}
            </div>
            {pago.pago === 'sinprecio' && (
              <div style={{ marginTop: 10, backgroundColor: colors.amberBg, color: colors.amberFg, borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.4 }}>
                <b>{t('pagoSinPrecio')}</b>
                <button
                  onClick={handleCargarPrecio}
                  style={{
                    display: 'block', width: '100%', marginTop: 8, padding: '9px 12px', borderRadius: 10, border: 'none',
                    backgroundColor: colors.primarySolid, color: colors.primaryFg, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {t('pagoCargar')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Turno de un combo: mover solo este o todo el combo ─── */}
        {pendientesCombo.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['este', 'combo'] as const).map(op => (
              <button
                key={op}
                onClick={() => setAlcanceHora(op)}
                aria-pressed={alcanceHora === op}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${alcanceHora === op ? colors.primaryDeep : colors.border}`,
                  backgroundColor: alcanceHora === op ? colors.surfaceSubtle : colors.surface, color: colors.text,
                }}
              >
                {op === 'este' ? t('soloEste') : t('todoElCombo')}
              </button>
            ))}
          </div>
        )}

        {enCombo && (
          <div style={{ marginBottom: 20 }}>
            <p style={sectionLabelStyle}>{t('seMueven')}</p>
            {pendientesCombo.map(p => (
              <div key={p.turno_id} style={{ fontSize: 14, color: colors.text, padding: '4px 2px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.fecha_hora.slice(11, 16)} hs · {t('conProfesional', { nombre: p.profesional_nombre ?? '' })}
              </div>
            ))}
            <label htmlFor="fecha-combo" style={{ ...sectionLabelStyle, display: 'block', marginTop: 14 }}>{t('nuevaFechaCombo')}</label>
            <input
              id="fecha-combo"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={fechaComboEf}
              onChange={e => setFechaCombo(e.target.value)}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {!enCombo && (<>
        {/* ─── CLIENTE ─── */}
        <p style={sectionLabelStyle}>{t('client')}</p>
        <div style={{ marginBottom: 20 }}>
          <ClienteSelector
            value={selectedCliente}
            onChange={setSelectedCliente}
            onNuevo={() => altaClienteRef.current?.open()}
            labels={{
              placeholder: t('select'),
              searchByName: t('searchByName'),
              noResults: t('noClientsFound'),
              loading: t('loadingClients'),
              retry: t('retry'),
              newClient: t('newClientOption'),
            }}
          />
        </div>

        {/* ─── PROFESIONAL ─── (invisible con ≤1 profesional activa). Fila + hoja
            compartidas. Elección OBLIGATORIA: arranca sin elegir (sin fila
            "todo el equipo") y la fila lee la MISMA variable que el resto de la
            pantalla (selectedProfesionalId). */}
        {mostrarSelectorProfesional && (
          <div style={{ marginBottom: 20 }}>
            <TarjetaQueMostrar>
              <FilaQueMostrar
                leading={profesionalSeleccionado ? (
                  <AvatarProfesional
                    nombre={profesionalSeleccionado.nombre}
                    apellido={profesionalSeleccionado.apellido}
                    color={profesionalSeleccionado.color}
                    avatarUrl={profesionalSeleccionado.avatar_url}
                  />
                ) : <SinProfesionalIcono />}
                titulo={t('professional')}
                valor={profesionalSeleccionado ? profesionalSeleccionado.nombre : t('chooseProfessional')}
                activo={profesionalSeleccionado !== null}
                onClick={() => setProfesionalAbierto(true)}
              />
            </TarjetaQueMostrar>
          </div>
        )}
        <ProfesionalSheet
          open={profesionalAbierto}
          onClose={() => setProfesionalAbierto(false)}
          // Volver a tocar la ya elegida no hace nada: el handler alterna
          // (la deselecciona y borra los servicios), y acá la elección es
          // obligatoria, así que deseleccionar solo dejaría la pantalla vacía.
          onSelect={sel => { if (sel !== 'equipo' && sel !== selectedProfesionalId) handleSeleccionarProfesional(sel); }}
          title={t('professional')}
          cerrarLabel={t('closeSheet')}
          profesionales={activeProfesionales.map(p => ({
            id: p.id, nombre: p.nombre, apellido: p.apellido, color: p.color, avatarUrl: p.avatar_url,
          }))}
          selectedId={selectedProfesionalId ?? 'equipo'}
        />

        {/* ─── SERVICIOS ─── */}
        <p style={sectionLabelStyle}>{t('services')}</p>
        {mostrarSelectorProfesional && !profesionalSeleccionado ? (
          <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 20px 2px' }}>
            {t('chooseProfessionalFirst')}
          </p>
        ) : serviciosDisponibles.length === 0 ? (
          <p style={{ fontSize: 13, color: colors.subtext, margin: '0 0 20px 2px' }}>
            {t('noServicesAssigned')}
          </p>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <SelectorServicios
              servicios={serviciosDisponibles}
              mode="multi"
              selectedIds={selectedServicioIds}
              onChange={setSelectedServicioIds}
            />
          </div>
        )}

        </>)}

        {!enCombo && (
          <>
            <label htmlFor="fecha-turno" style={{ ...sectionLabelStyle, display: 'block' }}>{t('appointmentDate')}</label>
            <input
              id="fecha-turno"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={fecha}
              onChange={e => {
                if (!e.target.value) return;
                setFecha(e.target.value);
                // La validacion de solapamientos corre contra los turnos del dia elegido.
                fetchTurnos(e.target.value);
              }}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 20 }}
            />
          </>
        )}

        <p style={sectionLabelStyle}>{t(enCombo ? 'horaCombo' : 'appointmentTime')}</p>
        <div
          onClick={() => { setTempHora(enCombo ? horaComboEf : horaSeleccionada); setShowHoraPicker(true); }}
          style={{ ...inputStyle, fontFamily: agendaFontSerif, fontSize: 18, cursor: 'pointer', marginBottom: 32 }}
        >
          {formatHora12(enCombo ? `${horaComboEf.hora}:${horaComboEf.minuto}` : `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`)}
        </div>

        {/* ─── Submit ─── */}
        <button
          onClick={enCombo ? handleMoverCombo : handleGuardar}
          disabled={enCombo ? saving : (
            saving || !selectedCliente || selectedServicioIds.length === 0 ||
            (mostrarSelectorProfesional && !selectedProfesionalId) || slotsDesactualizados
          )}
          style={{
            width: '100%', height: 52, borderRadius: 14,
            backgroundColor: colors.primarySolid, color: colors.primaryFg,
            fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: enCombo ? 1 : (
              !selectedCliente || selectedServicioIds.length === 0 ||
              (mostrarSelectorProfesional && !selectedProfesionalId) || slotsDesactualizados
            ) ? 0.5 : 1,
          }}
        >
          {enCombo ? (saving ? t('saving') : t('moverCombo')) : slotsDesactualizados ? <Spinner size={18} variante="sobreOscuro" label={t('loadingSchedule')} /> : saving ? t('saving') : t('saveChanges')}
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
              onClick={() => { if (enCombo) setHoraCombo(tempHora); else setHoraSeleccionada(tempHora); setShowHoraPicker(false); }}
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

      <AltaClienteRapidaSheet
        ref={altaClienteRef}
        onCreated={(c) => setSelectedCliente(c)}
      />
    </div>
  );
}
