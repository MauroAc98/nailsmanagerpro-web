'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, User, CheckCircle2, Plus } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { agendaColors as colors, agendaShadows as shadows, agendaFontSerif } from '@/theme/agendaColors';
import { AvatarProfesional } from '@/components/filtros/AvatarProfesional';
import { FilaQueMostrar } from '@/components/filtros/FilaQueMostrar';
import { TarjetaQueMostrar } from '@/components/filtros/TarjetaQueMostrar';
import { ProfesionalSheet, SinProfesionalIcono } from '@/components/filtros/ProfesionalSheet';
import { WhatsappGlyph } from '@/components/icons/WhatsappGlyph';
import { SelectorServicios } from '@/components/SelectorServicios';
import { AltaClienteRapidaSheet, type AltaClienteRapidaHandle } from '@/components/clientes/AltaClienteRapidaSheet';
import { useTurnoStore } from '@/store/useTurnoStore';
import { useServiciosStore } from '@/store/useServicioStore';
import { useClientesStore } from '@/store/useClienteStore';
import { useSlotsStore } from '@/store/useSlotsStore';
import { useProfesionalStore } from '@/store/useProfesionalStore';
import { useBloqueosAgendaStore } from '@/store/useBloqueosAgendaStore';
import { Cliente } from '@/services/clienteService';
import { profesionalJefa } from '@/services/profesionalService';
import { DrumPicker } from '@/components/DrumPicker';
import {
  armarPayloadLote, bloqueNuevoDesde, detalleResumen, diaLargo, evaluarBloque, horaCorta12, itemsDeConfirmacion,
  quitarBloque, tituloResumen,
  type BloqueTurno, type ItemConfirmacion,
} from '@/lib/turnosLote';
import { slotService, type Slot } from '@/services/slotService';
import { ClienteConTelefono } from '@/components/agenda/ClienteConTelefono';
import { ResumenTurnoPlegado } from '@/components/agenda/ResumenTurnoPlegado';
import { BloqueTurnoAbierto } from '@/components/agenda/BloqueTurnoAbierto';
import { ElegirFechaBloqueSheet, type ElegirFechaBloqueHandle } from '@/components/agenda/ElegirFechaBloqueSheet';
import { alertDialog, confirmDialog } from '@/store/useConfirmStore';
import { showToast } from '@/store/useToastStore';
import { formatFecha, fechaDeHoy } from '@/lib/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import { whatsappHelper } from '@/lib/whatsappHelper';
import { useAuthStore } from '@/store/useAuthStore';
import { servicioService, type Servicio } from '@/services/servicioService';
import { advertenciaDelCombo, tramosDelCombo } from '@/lib/comboManual';

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
  return `${horaCorta12(hora24)} hs`;
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
  const fechaUrl     = searchParams.get('fecha') ?? today;
  // Día del turno que se está editando: arranca en el de la URL; solo cambia con
  // varios turnos (fila "Día" de cada bloque).
  const [fecha, setFecha] = useState(fechaUrl);

  const { crearTurno, crearLote, turnos, fetchTurnos }  = useTurnoStore();
  const { servicios, fetchServicios }        = useServiciosStore();
  const { clientes, fetchClientes, loading: clientesLoading, error: clientesError } = useClientesStore();
  const { slots, fetchSlots, loading: slotsLoading, ultimoProfesionalIdSolicitado } = useSlotsStore();
  const { profesionales, fetchProfesionales } = useProfesionalStore();
  const { bloqueos, fetchBloqueos } = useBloqueosAgendaStore();
  const user = useAuthStore(s => s.user);
  const { requiereEnvioManualWhatsapp }      = useAuth();

  const altaClienteRef = useRef<AltaClienteRapidaHandle>(null);

  const [selectedCliente,      setSelectedCliente]      = useState<Cliente | null>(null);
  const [selectedServicioIds,  setSelectedServicioIds]  = useState<number[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<number | null>(null);
  const [profesionalAbierto, setProfesionalAbierto] = useState(false);
  const [showClienteDropdown,  setShowClienteDropdown]  = useState(false);
  const [clienteBuscar,        setClienteBuscar]        = useState('');
  const [showHoraPicker,       setShowHoraPicker]       = useState(false);
  const [saving,               setSaving]               = useState(false);
  // Combo (promo con componentes): detalle de la promo elegida y precio manual opcional.
  const [comboDetalle, setComboDetalle] = useState<Servicio | null>(null);
  const [precioPromo,  setPrecioPromo]  = useState('');
  const [turnoCreado, setTurnoCreado] = useState<{
    cliente: Cliente;
    items: ItemConfirmacion[];   // uno por turno creado (uno solo en el alta simple)
    lote?: boolean;
  } | null>(null);

  const now      = new Date();
  const initialH = String(now.getHours()).padStart(2, '0');

  // Varios turnos: `bloques` guarda todos; el que está abierto (`activo`) se edita
  // en los estados de siempre (servicios, profesional, hora, fecha) y su entrada
  // en `bloques` queda vieja hasta que se pliega (ver bloqueEnCurso).
  const [bloques, setBloques] = useState<BloqueTurno[]>([
    { fecha: fechaUrl, hora: `${initialH}:00`, servicioIds: [], profesionalId: null },
  ]);
  const [activo, setActivo] = useState(0);
  const enLote = bloques.length > 1;
  const elegirFechaRef = useRef<ElegirFechaBloqueHandle>(null);
  const [horaSeleccionada, setHoraSeleccionada] = useState<Record<string, string>>({ hora: initialH, minuto: '00' });
  const [tempHora,         setTempHora]         = useState<Record<string, string>>({ hora: initialH, minuto: '00' });

  useEffect(() => {
    if (clientes.length === 0) fetchClientes();
    if (servicios.length === 0) fetchServicios();
    if (slots.length === 0) fetchSlots();
    if (profesionales.length === 0) fetchProfesionales();
    fetchTurnos(fecha);
    fetchBloqueos();
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

  const handleSeleccionarProfesional = (id: number) => {
    setSelectedProfesionalId(prev => prev === id ? null : id);
    // Los servicios disponibles cambian con la profesional — no arrastrar
    // selecciones que puede que ya no ofrezca.
    setSelectedServicioIds([]);
  };

  // Con selector visible, solo se ofrecen los servicios de la profesional
  // elegida (vacío hasta elegir una). Sin selector, comportamiento intacto.
  // Los combos (promo con componentes: `modo_promo` viene en el listado) se
  // ofrecen siempre: sus profesionales estan fijadas por la propia promo.
  const combos = servicios.filter(s => s.activo && s.es_promo && s.modo_promo);
  const serviciosBase = mostrarSelectorProfesional
    ? (profesionalSeleccionado
        ? servicios.filter(s => s.activo && profesionalSeleccionado.servicios.some(ps => ps.id === s.id))
        : [])
    : servicios.filter(s => s.activo);
  const serviciosConCombos = [...serviciosBase, ...combos.filter(c => !serviciosBase.some(s => s.id === c.id))];
  // Con varios turnos no hay combos: el backend los rechaza en lote.
  const serviciosDisponibles = enLote
    ? serviciosConCombos.filter(s => !combos.some(c => c.id === s.id))
    : serviciosConCombos;

  const seleccionaCombo = selectedServicioIds.length === 1 && combos.some(c => c.id === selectedServicioIds[0]);
  const mezclaCombo = selectedServicioIds.length > 1 && selectedServicioIds.some(id => combos.some(c => c.id === id));
  const esCombo = seleccionaCombo && comboDetalle?.id === selectedServicioIds[0];
  const horaCombo = `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`;
  const tramosCombo = esCombo && comboDetalle ? tramosDelCombo(comboDetalle, horaCombo) : [];
  // `sin_inicios_alineados` solo limita lo que se ofrece online: la duena agenda a cualquier hora.
  const problemasCombo = esCombo ? (comboDetalle?.problemas ?? []).filter(p => p.codigo !== 'sin_inicios_alineados') : [];

  const handleCambiarServicios = (ids: number[]) => {
    setSelectedServicioIds(ids);
    setComboDetalle(null);
    if (ids.length === 1 && combos.some(c => c.id === ids[0])) {
      servicioService.getOne(ids[0]).then(d => setComboDetalle(prev => (prev === null ? d : prev))).catch(() => {});
    }
  };

  // `slots` es un store global compartido — al elegir una profesional se
  // dispara fetchSlots(selectedProfesionalId) (efecto de arriba), pero esa
  // request es async. Si el usuario confirma ANTES de que resuelva, `slots`
  // en el store todavía puede ser el de la profesional anterior (o estar
  // vacío) y validarTurno terminaría chequeando el horario de atención
  // equivocado, sin ningún aviso. `ultimoProfesionalIdSolicitado` (del
  // store) es la última profesional que efectivamente se pidió — si no
  // coincide con la seleccionada, o si el fetch todavía está en vuelo,
  // `slots` no es confiable todavía.
  const slotsDesactualizados = mostrarSelectorProfesional && selectedProfesionalId != null
    && (ultimoProfesionalIdSolicitado !== selectedProfesionalId || slotsLoading);

  // Alta de un combo: un turno por servicio con SU profesional (las fija la promo). La duena
  // agenda a cualquier hora; el backend valida rango, choques y reservas en curso por profesional.
  const handleConfirmarCombo = async () => {
    if (!selectedCliente || !esCombo || problemasCombo.length > 0) return;
    const advertencia = advertenciaDelCombo(tramosCombo, fecha, profesionales, bloqueos);
    if (advertencia && !(await confirmDialog(advertencia))) return;

    setSaving(true);
    const precio = Number(precioPromo);
    const result = await crearTurno({
      cliente_id:   selectedCliente.id,
      servicio_ids: selectedServicioIds,
      fecha_hora:   `${fecha} ${horaCombo}`,
      ...(precioPromo.trim() !== '' && Number.isFinite(precio) ? { precio_promo: Math.round(precio) } : {}),
    });
    setSaving(false);
    if (!result.success) {
      await alertDialog(result.code === 'slot_held' ? t('comboSlotHeld') : (result.message ?? t('createError')));
      return;
    }
    showToast(t('created'));
    router.back();
  };

  // Link wa.me de la confirmación manual de UN turno (el mismo mensaje en el alta simple
  // y, por turno, en el alta de varios).
  const urlConfirmacion = (cliente: Cliente, item: ItemConfirmacion) => whatsappHelper.buildUrl({
    clienteNombre:   cliente.nombre,
    clienteTelefono: cliente.telefono!,
    servicio:        item.servicios,
    fecha:           item.fecha,
    hora:            item.hora,
    tipo:            'confirmacion',
    negocio:         user?.name ?? '',
    direccion:       user?.direccion ?? null,
    telefonoNegocio: user?.telefono ?? null,
  });

  // ─────────────────────────────────────────────
  // Varios turnos (bloques)
  // ─────────────────────────────────────────────
  // El bloque abierto, con lo que hay ahora mismo en los campos.
  const bloqueEnCurso = (): BloqueTurno => ({
    fecha,
    hora: `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`,
    servicioIds: selectedServicioIds,
    profesionalId: mostrarSelectorProfesional ? selectedProfesionalId : null,
  });
  // Todos los bloques con el abierto al día.
  const bloquesAlDia = (): BloqueTurno[] => bloques.map((b, i) => (i === activo ? bloqueEnCurso() : b));

  const cargarBloque = (b: BloqueTurno) => {
    const [hora, minuto] = b.hora.split(':');
    setFecha(b.fecha);
    setHoraSeleccionada({ hora, minuto });
    setSelectedServicioIds(b.servicioIds);
    setSelectedProfesionalId(b.profesionalId);
    setComboDetalle(null);
    setPrecioPromo('');
  };
  const mostrarBloque = (lista: BloqueTurno[], indice: number) => {
    setBloques(lista);
    setActivo(indice);
    cargarBloque(lista[indice]);
  };

  // Profesional a considerar para el aviso no bloqueante de días/bloqueos:
  // con selector visible, la elegida; sin selector (≤1 activa), la única
  // activa (misma resolución de default que usan configuracion/servicios y
  // configuracion/slots — ver profesionalJefa).
  const profesionalDelBloque = (b: BloqueTurno) => (mostrarSelectorProfesional
    ? activeProfesionales.find(p => p.id === b.profesionalId) ?? null
    : profesionalJefa(activeProfesionales));
  const evaluar = (b: BloqueTurno, slotsDelBloque: Slot[] = slots) => evaluarBloque({
    bloque: b, clienteId: selectedCliente!.id, servicios, turnos, slots: slotsDelBloque, bloqueos,
    profesional: profesionalDelBloque(b), requiereProfesional: mostrarSelectorProfesional,
  });
  // Cada profesional tiene sus propias horas de atención: un bloque de otra profesional
  // que la de los `slots` cargados se valida contra los suyos.
  const slotsDelBloque = async (b: BloqueTurno): Promise<Slot[]> => {
    if (!mostrarSelectorProfesional || b.profesionalId == null || b.profesionalId === ultimoProfesionalIdSolicitado) return slots;
    try { return await slotService.getAll(b.profesionalId); } catch { return slots; }
  };
  const conNumero = (n: number, mensaje: string) => (enLote ? t('blockError', { n, mensaje }) : mensaje);

  // Antes de plegar el bloque abierto: solo los errores duros; los avisos se confirman al final.
  const validarBloqueAbierto = async (): Promise<boolean> => {
    const { error } = evaluar(bloqueEnCurso());
    if (error) { await alertDialog(conNumero(activo + 1, error)); return false; }
    return true;
  };

  const handleAgregarTurno = async () => {
    if (!selectedCliente || !(await validarBloqueAbierto())) return;
    const actuales = bloquesAlDia();
    mostrarBloque([...actuales, bloqueNuevoDesde(actuales[activo], `${initialH}:00`)], actuales.length);
  };

  const handleAbrirBloque = async (indice: number) => {
    if (!(await validarBloqueAbierto())) return;
    mostrarBloque(bloquesAlDia(), indice);
  };

  const handleQuitarBloque = () => {
    const r = quitarBloque(bloquesAlDia(), activo);
    mostrarBloque(r.bloques, r.activo);
  };

  const tituloDelBloque = (b: BloqueTurno) => tituloResumen(b.fecha, b.hora);
  const detalleDelBloque = (b: BloqueTurno) => {
    const prof = mostrarSelectorProfesional ? activeProfesionales.find(p => p.id === b.profesionalId) : null;
    return detalleResumen(
      b.servicioIds.map(id => servicios.find(s => s.id === id)?.nombre).filter((n): n is string => !!n),
      prof ? t('withProfessional', { nombre: prof.nombre }) : null,
    );
  };

  const handleConfirmarLote = async () => {
    if (!selectedCliente || deshabilitado) return;
    const todos = bloquesAlDia();

    const avisos: (string | null)[] = [];
    for (let i = 0; i < todos.length; i++) {
      const { error, advertencia } = evaluar(todos[i], await slotsDelBloque(todos[i]));
      if (error) {
        mostrarBloque(todos, i);
        await alertDialog(t('blockError', { n: i + 1, mensaje: error }));
        return;
      }
      avisos.push(advertencia);
    }
    for (let i = 0; i < avisos.length; i++) {
      const aviso = avisos[i];
      if (aviso && !(await confirmDialog(t('blockError', { n: i + 1, mensaje: aviso })))) return;
    }

    setSaving(true);
    const result = await crearLote(armarPayloadLote(selectedCliente.id, todos));
    setSaving(false);
    if (!result.success) {
      const conIndice = result.indice !== undefined && result.indice < todos.length;
      if (conIndice) mostrarBloque(todos, result.indice!);
      await alertDialog(
        result.code === 'slot_held'
          ? (conIndice ? t('blockError', { n: result.indice! + 1, mensaje: t('comboSlotHeld') }) : t('comboSlotHeld'))
          : (result.message ?? t('createError')),
      );
      return;
    }

    // Con envío manual de WhatsApp: pantalla de éxito con un botón por turno creado.
    if (requiereEnvioManualWhatsapp && selectedCliente.telefono) {
      const items: ItemConfirmacion[] = result.turnos?.length
        ? itemsDeConfirmacion(result.turnos)
        : todos.map(b => ({
            fecha: b.fecha, hora: b.hora,
            servicios: servicios.filter(s => b.servicioIds.includes(s.id)).map(s => s.nombre).join(' + '),
          }));
      setTurnoCreado({ cliente: selectedCliente, items, lote: true });
    } else {
      showToast(t('createdMany'));
      router.back();
    }
  };

  const handleConfirmar = async () => {
    if (enLote) return handleConfirmarLote();
    if (esCombo) return handleConfirmarCombo();
    if (!selectedCliente || selectedServicioIds.length === 0) return;
    if (mostrarSelectorProfesional && !selectedProfesionalId) return;
    if (slotsDesactualizados) return;

    const hora = `${horaSeleccionada.hora}:${horaSeleccionada.minuto}`;
    // Validación dura (alert) y, DESPUÉS, el aviso NO bloqueante de día no laborable o
    // fecha bloqueada (confirm) — ver lib/turnoAdvertencias.ts. Ambos corren ANTES del
    // submit real, sin duplicar ni suprimir el 422 del backend.
    const { error: errorValidacion, advertencia } = evaluar(bloqueEnCurso());
    if (errorValidacion) {
      await alertDialog(errorValidacion);
      return;
    }
    if (advertencia) {
      const confirmado = await confirmDialog(advertencia);
      if (!confirmado) return;
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
        items: [{ fecha, hora, servicios: nombresServicios }],
      });
    } else {
      showToast(t('created'));
      router.back();
    }
  };

  const deshabilitado =
    saving || !selectedCliente || selectedServicioIds.length === 0 || mezclaCombo || problemasCombo.length > 0 ||
    (seleccionaCombo && !esCombo) ||
    (!seleccionaCombo && ((mostrarSelectorProfesional && !selectedProfesionalId) || slotsDesactualizados));

  // "Agregar otro turno": con cliente elegido y sin promo-combo en el turno abierto.
  const mostrarAgregar = !!selectedCliente && !seleccionaCombo && !mezclaCombo;

  const clientesFiltrados = clientes.filter(c =>
    c.activo && normalizarTexto(`${c.nombre} ${c.apellido} ${c.telefono ?? ''}`).includes(normalizarTexto(clienteBuscar))
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 4px' }}>
        <BackButton />
      </div>

      <div style={{ padding: '4px 20px 18px' }}>
        {!enLote && (
          <p style={{
            fontSize: 11, fontWeight: 700, color: colors.primaryDeep, letterSpacing: 1.5,
            textTransform: 'uppercase', margin: '0 0 4px',
          }}>
            {t('selectedDay', { fecha: formatFechaLarga(fecha) })}
          </p>
        )}
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
              {turnoCreado.lote ? t('appointmentsCreatedTitle') : t('appointmentCreatedTitle')}
            </h2>
            <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
              {turnoCreado.lote ? t('manualConfirmationNoticeMany') : t('manualConfirmationNotice')}
            </p>
          </div>
          {/* Varios turnos: un botón de WhatsApp por turno (mismo mensaje que el turno simple). */}
          {turnoCreado.lote && (
            <div style={{ marginBottom: 12 }}>
              {turnoCreado.items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
                  backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16,
                  boxShadow: shadows.card, padding: '12px 14px',
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: agendaFontSerif, fontSize: 16, color: colors.textStrong }}>
                      {tituloResumen(item.fecha, item.hora)}
                    </span>
                    <span style={{
                      display: 'block', marginTop: 2, fontSize: 12, color: colors.subtext,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.servicios}
                    </span>
                  </span>
                  <a
                    href={urlConfirmacion(turnoCreado.cliente, item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('sendConfirmationFor', { resumen: tituloResumen(item.fecha, item.hora) })}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px',
                      borderRadius: 12, backgroundColor: colors.whatsapp, color: colors.primaryFg,
                      textDecoration: 'none', fontSize: 14, fontWeight: 700, boxSizing: 'border-box',
                    }}
                  >
                    <WhatsappGlyph size={16} />
                    {t('sendShort')}
                  </a>
                </div>
              ))}
            </div>
          )}
          {!turnoCreado.lote && <a
            href={urlConfirmacion(turnoCreado.cliente, turnoCreado.items[0])}
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
          </a>}
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
              borderColor: showClienteDropdown ? colors.primaryDeep : colors.border,
            }}
          >
            <User size={18} strokeWidth={1.8} color={colors.muted} style={{ flexShrink: 0 }} />
            {selectedCliente ? (
              <ClienteConTelefono cliente={selectedCliente} variante="campo" />
            ) : (
              <span style={{
                flex: 1, minWidth: 0, color: colors.placeholder, fontSize: 15,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {t('select')}
              </span>
            )}
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
              {/* Alta rápida sin salir del turno — arriba de todo, no al
                  final de la lista: con muchos clientes cargados había que
                  scrollear toda la lista para llegar a esta opción (feedback
                  real). Antes de esto había que ir a /clientes/nuevo y
                  volver, perdiendo lo ya cargado en el turno. */}
              <div
                onClick={() => { setShowClienteDropdown(false); altaClienteRef.current?.open(); }}
                style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: colors.primaryDeep, borderBottom: `1px solid ${colors.hairline}` }}
              >
                {t('newClientOption')}
              </div>
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
                  <ClienteConTelefono cliente={c} variante="fila" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Turnos ya cargados (plegados), antes del abierto ─── */}
        {bloques.slice(0, activo).map((b, i) => (
          <ResumenTurnoPlegado
            key={i}
            numero={i + 1}
            titulo={tituloDelBloque(b)}
            detalle={detalleDelBloque(b)}
            ariaLabel={t('editAppointmentSummary', { n: i + 1, resumen: tituloDelBloque(b) })}
            onClick={() => handleAbrirBloque(i)}
          />
        ))}

        <BloqueTurnoAbierto
          lote={enLote}
          numero={activo + 1}
          titulo={t('appointmentN', { n: activo + 1 })}
          quitarLabel={t('removeAppointment', { n: activo + 1 })}
          onQuitar={handleQuitarBloque}
          diaLabel={t('day')}
          diaTexto={diaLargo(fecha)}
          onElegirDia={() => elegirFechaRef.current?.abrir()}
        >
        {/* ─── PROFESIONAL ─── (invisible con ≤1 profesional activa). Fila + hoja
            compartidas. Elección OBLIGATORIA: arranca sin elegir (sin fila
            "todo el equipo") y la fila lee la MISMA variable que el resto de la
            pantalla (selectedProfesionalId). */}
        {mostrarSelectorProfesional && !seleccionaCombo && (
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
        {mostrarSelectorProfesional && !profesionalSeleccionado && serviciosDisponibles.length === 0 ? (
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
              onChange={handleCambiarServicios}
            />
          </div>
        )}

        {/* ─── COMBO: qué se agenda (cada servicio con su profesional) ─── */}
        {mezclaCombo && (
          <p style={{ fontSize: 13, color: colors.dangerBorder, margin: '0 0 20px 2px' }}>{t('comboSolo')}</p>
        )}
        {esCombo && (
          <div style={{ marginBottom: 20 }}>
            <p style={sectionLabelStyle}>{t('comboTitulo')}</p>
            {tramosCombo.map((tr, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 2px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('comboLinea', { servicio: tr.servicio, profesional: tr.profesional })}
                </span>
                <span style={{ flexShrink: 0, fontSize: 13, color: colors.subtext }}>{t('comboRango', { inicio: tr.inicio, fin: tr.fin })}</span>
              </div>
            ))}
            {problemasCombo.map((p, i) => (
              <p key={i} style={{ fontSize: 13, color: colors.dangerBorder, margin: '6px 2px 0' }}>{p.mensaje}</p>
            ))}
            <label style={{ ...sectionLabelStyle, display: 'block', marginTop: 14 }} htmlFor="precio-combo">{t('comboPrecio')}</label>
            <input
              id="precio-combo"
              inputMode="numeric"
              placeholder={comboDetalle?.precio ? String(Math.round(Number(comboDetalle.precio))) : ''}
              value={precioPromo}
              onChange={e => setPrecioPromo(e.target.value.replace(/\D/g, ''))}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* ─── HORA DEL TURNO ─── */}
        <p style={sectionLabelStyle}>{t('appointmentTime')}</p>
        <div
          onClick={() => { setTempHora(horaSeleccionada); setShowHoraPicker(true); }}
          style={{ ...inputStyle, fontFamily: agendaFontSerif, fontSize: 18, cursor: 'pointer', marginBottom: enLote ? 0 : mostrarAgregar ? 14 : 32 }}
        >
          {formatHora12(`${horaSeleccionada.hora}:${horaSeleccionada.minuto}`)}
        </div>
        </BloqueTurnoAbierto>

        {/* ─── Turnos ya cargados (plegados), después del abierto ─── */}
        {bloques.slice(activo + 1).map((b, k) => {
          const i = activo + 1 + k;
          return (
            <ResumenTurnoPlegado
              key={i}
              numero={i + 1}
              titulo={tituloDelBloque(b)}
              detalle={detalleDelBloque(b)}
              ariaLabel={t('editAppointmentSummary', { n: i + 1, resumen: tituloDelBloque(b) })}
              onClick={() => handleAbrirBloque(i)}
            />
          );
        })}

        {/* ─── Agregar otro turno (misma persona). Sin combos: el backend los rechaza en lote. ─── */}
        {mostrarAgregar && (
          <button
            type="button"
            onClick={handleAgregarTurno}
            disabled={deshabilitado}
            style={{
              width: '100%', height: 46, borderRadius: 12, marginBottom: 24,
              border: `1.5px dashed ${colors.border}`, backgroundColor: 'transparent',
              color: colors.primaryDeep, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: deshabilitado ? 0.5 : 1,
            }}
          >
            <Plus size={16} strokeWidth={2.2} color={colors.primarySolid} />
            {t('addAnotherAppointment')}
          </button>
        )}

        {/* ─── Submit ─── */}
        <button
          onClick={handleConfirmar}
          disabled={deshabilitado}
          style={{
            width: '100%', height: 52, borderRadius: 14,
            backgroundColor: colors.primarySolid, color: colors.primaryFg,
            fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
            opacity: deshabilitado && !saving ? 0.5 : 1,
          }}
        >
          {slotsDesactualizados ? t('loadingSchedule') : saving ? t('saving') : enLote ? t('confirmMany', { count: bloques.length }) : t('confirmAppointment')}
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
                backgroundColor: colors.primarySolid, color: colors.primaryFg,
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      )}

      <ElegirFechaBloqueSheet ref={elegirFechaRef} fecha={fecha} onSelect={setFecha} />

      <AltaClienteRapidaSheet
        ref={altaClienteRef}
        onCreated={(c) => setSelectedCliente(c)}
      />
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
