'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, Search, Building2, X, CircleCheck, TriangleAlert, RefreshCw, Ban, RotateCcw, CalendarClock } from 'lucide-react';
import { adminService, NegocioLookupResult, SubscriptionStatus } from '@/services/adminService';
import { colors, shadows, withAlpha } from '@/theme/colors';

// Mismo formateo que app/(app)/perfil/page.tsx (formatFechaCorta) — no se
// extrajo a un helper compartido porque esta es la única otra pantalla que
// necesita fecha corta es-AR fuera de esa page.
function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Solo hay ~6 negocios hoy (ver AGENTS de la task): se trae la lista
// completa una sola vez con GET admin/negocios (AdminController::
// listarNegocios, ordenado por vencimiento más próximo primero) y el input
// de arriba filtra ese array ya en memoria — sin debounce, sin request por
// tecla, sin paginación/virtualización. Si el negocio crece más allá de un
// puñado de filas esto deja de alcanzar y hay que volver a un buscador
// server-side como el que tenía esta pantalla antes.
type ConflictoRenovacion = {
  renewed_at: string;
  ends_at: string;
  hint: string;
};

// Cuál de las cuatro acciones tiene su panel de confirmación abierto. null =
// se muestran los botones de acción, ninguno en modo confirmación.
type AccionActiva = 'renew' | 'suspend' | 'reactivate' | 'adjust' | null;

// Resultado unificado de cualquier acción exitosa (renew / suspend /
// reactivate / adjust). renew arma el mensaje client-side; las otras tres
// usan el `message` que devuelve el backend.
type ResultadoAccion = {
  mensaje: string;
  endsAt: string | null;
};

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

// 422 de adjust-expiry: el backend responde con el shape de validación de
// Laravel ({ message, errors: { ends_at: [...] } }). Se juntan todos los
// mensajes de campo; si no vienen, se cae al `message` general.
function extraerValidacion(e: unknown): string | null {
  if (isAxiosError(e) && e.response?.status === 422) {
    const data = e.response.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const errores = data?.errors ? Object.values(data.errors).flat() : [];
    if (errores.length > 0) return errores.join(' ');
    return data?.message ?? 'La fecha ingresada no es válida.';
  }
  return null;
}

// SUSPENDIDO se pinta con el rojo de peligro (corte por acción de un admin),
// distinto de VENCIDO que va en ámbar (venció solo, hay que renovar) y de
// ACTIVO en verde. Colores de theme/colors — responden al tema activo.
const ESTADO_ESTILOS: Record<SubscriptionStatus, { fg: string; bg: string }> = {
  ACTIVO: { fg: colors.success, bg: colors.successBg },
  VENCIDO: { fg: colors.amber, bg: colors.amberBg },
  SUSPENDIDO: { fg: colors.danger, bg: colors.dangerBg },
};

function EstadoChip({ status }: { status: SubscriptionStatus }) {
  const s = ESTADO_ESTILOS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        color: s.fg,
        backgroundColor: s.bg,
      }}
    >
      {status}
    </span>
  );
}

const btnPrimario = {
  height: 50,
  borderRadius: 14,
  backgroundColor: colors.primarySolid,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
} as const;

const btnPeligro = {
  height: 50,
  borderRadius: 14,
  backgroundColor: 'transparent',
  color: colors.danger,
  fontSize: 14,
  fontWeight: 600,
  border: `1px solid ${colors.dangerBorder}`,
  cursor: 'pointer',
} as const;

const btnSecundario = {
  height: 50,
  borderRadius: 14,
  backgroundColor: 'transparent',
  color: colors.textStrong,
  fontSize: 14,
  fontWeight: 600,
  border: `1px solid ${colors.border}`,
  cursor: 'pointer',
} as const;

export default function SuscripcionesPage() {
  const [negocios, setNegocios] = useState<NegocioLookupResult[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const [seleccionado, setSeleccionado] = useState<NegocioLookupResult | null>(null);
  // Estado de acción compartido por las cuatro operaciones (renew / suspend /
  // reactivate / adjust). `conflicto` es exclusivo de renew (409 dentro de la
  // ventana de 24hs -> se ofrece force). `fechaAjuste` / `validacionAjuste`
  // son exclusivos de adjust.
  const [accionActiva, setAccionActiva] = useState<AccionActiva>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAccion | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoRenovacion | null>(null);
  const [fechaAjuste, setFechaAjuste] = useState('');
  const [validacionAjuste, setValidacionAjuste] = useState<string | null>(null);

  const cargarNegocios = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await adminService.listarNegocios();
      setNegocios(data);
    } catch (e: unknown) {
      setNegocios(null);
      setErrorCarga(extraerMensajeError(e, 'No se pudo cargar la lista de negocios.'));
    } finally {
      setCargando(false);
    }
  };

  // Fetch inicial al montar — mismo patrón ya usado en hooks/useHistoriaPrecios.ts
  // para "setState en efecto para sincronizar con una fuente externa al
  // montar/cambiar de identidad": eslint-plugin-react-hooks marca esto como
  // sub-óptimo porque dispara un render extra, pero la alternativa (llamar
  // setCargando/setNegocios durante el render) no es válida para un fetch
  // async disparado una sola vez al montar.
  /* eslint-disable react-hooks/set-state-in-effect -- fetch inicial de la
     lista de negocios al montar, ver comentario arriba. */
  useEffect(() => {
    cargarNegocios();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const negociosFiltrados = useMemo(() => {
    if (!negocios) return [];
    const q = filtro.trim().toLowerCase();
    if (!q) return negocios;
    return negocios.filter(
      (n) => n.name.toLowerCase().includes(q) || n.email.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q)
    );
  }, [negocios, filtro]);

  const resetSeleccion = () => {
    setSeleccionado(null);
    setAccionActiva(null);
    setProcesando(false);
    setResultado(null);
    setConflicto(null);
    setErrorAccion(null);
    setFechaAjuste('');
    setValidacionAjuste(null);
  };

  const handleSeleccionar = (negocio: NegocioLookupResult) => {
    resetSeleccion();
    setSeleccionado(negocio);
  };

  // El click en un botón de acción solo abre su paso de confirmación —
  // todavía no dispara el POST (mismo criterio que tenía renew).
  const abrirAccion = (accion: Exclude<AccionActiva, null>) => {
    setAccionActiva(accion);
    setErrorAccion(null);
    setConflicto(null);
    setValidacionAjuste(null);
  };

  const cerrarAccion = () => {
    setAccionActiva(null);
    setErrorAccion(null);
    setConflicto(null);
    setValidacionAjuste(null);
  };

  // Refresco silencioso de la lista tras una acción exitosa: la card de éxito
  // sigue mostrándose (seleccionado no se toca), pero al volver a la lista el
  // ends_at/status ya reflejan el cambio recién hecho.
  const onAccionExitosa = (res: ResultadoAccion) => {
    setResultado(res);
    setAccionActiva(null);
    cargarNegocios();
  };

  const ejecutarRenovacion = async (force: boolean) => {
    if (!seleccionado) return;
    setProcesando(true);
    setErrorAccion(null);
    setConflicto(null);
    try {
      const response = await adminService.renovarSuscripcion(seleccionado.id, force);
      onAccionExitosa({ mensaje: 'Suscripción renovada', endsAt: response.ends_at });
    } catch (e: unknown) {
      // 409 puede ser: (a) renovación dentro de la ventana de 24hs -> se
      // ofrece "force"; (b) la suscripción está SUSPENDIDA -> hay que
      // reactivar primero, sin force. Se distinguen por el shape del body:
      // la dedup trae `renewed_at`, la suspensión no.
      if (isAxiosError(e) && e.response?.status === 409 && e.response.data && typeof e.response.data === 'object' && 'renewed_at' in e.response.data) {
        setConflicto(e.response.data as ConflictoRenovacion);
      } else {
        setErrorAccion(extraerMensajeError(e, 'No se pudo renovar la suscripción.'));
      }
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarSuspension = async () => {
    if (!seleccionado) return;
    setProcesando(true);
    setErrorAccion(null);
    try {
      const response = await adminService.suspenderSuscripcion(seleccionado.id);
      onAccionExitosa({ mensaje: response.message, endsAt: response.ends_at });
    } catch (e: unknown) {
      // 409 = ya estaba suspendida — se muestra el mensaje del backend tal cual.
      setErrorAccion(extraerMensajeError(e, 'No se pudo suspender la suscripción.'));
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarReactivacion = async () => {
    if (!seleccionado) return;
    setProcesando(true);
    setErrorAccion(null);
    try {
      const response = await adminService.reactivarSuscripcion(seleccionado.id);
      onAccionExitosa({ mensaje: response.message, endsAt: response.ends_at });
    } catch (e: unknown) {
      // 409 = no estaba suspendida — mensaje del backend tal cual.
      setErrorAccion(extraerMensajeError(e, 'No se pudo reactivar la suscripción.'));
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarAjuste = async () => {
    if (!seleccionado || !fechaAjuste) return;
    setProcesando(true);
    setErrorAccion(null);
    setValidacionAjuste(null);
    try {
      const response = await adminService.ajustarVencimiento(seleccionado.id, fechaAjuste);
      onAccionExitosa({ mensaje: response.message, endsAt: response.ends_at });
      setFechaAjuste('');
    } catch (e: unknown) {
      const validacion = extraerValidacion(e);
      if (validacion) {
        setValidacionAjuste(validacion);
      } else {
        setErrorAccion(extraerMensajeError(e, 'No se pudo ajustar el vencimiento.'));
      }
    } finally {
      setProcesando(false);
    }
  };

  const estadoActual: SubscriptionStatus | null = seleccionado?.subscription?.status ?? null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Suscripciones</h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Elegí un negocio de la lista para gestionar su suscripción.</p>
        </div>

        {!seleccionado && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              height: 54,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.card,
              borderRadius: 16,
              paddingLeft: 16,
              paddingRight: 12,
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Search size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Filtrar por nombre, email o slug"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              style={{ flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
            />
            {filtro && (
              <button
                type="button"
                onClick={() => setFiltro('')}
                aria-label="Limpiar filtro"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, border: 'none', backgroundColor: 'transparent', color: colors.subtext, cursor: 'pointer', padding: 0 }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {cargando && !seleccionado && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>Cargando negocios…</p>
        )}

        {errorCarga && !seleccionado && (
          <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }} role="alert">
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorCarga}</p>
            <button
              type="button"
              onClick={cargarNegocios}
              style={{ alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 10, border: `1px solid ${colors.dangerBorder}`, backgroundColor: 'transparent', color: colors.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && negocios !== null && negocios.length === 0 && !seleccionado && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>No hay negocios registrados.</p>
        )}

        {!cargando && !errorCarga && negocios !== null && negocios.length > 0 && negociosFiltrados.length === 0 && !seleccionado && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>
            No se encontró ningún negocio para &quot;{filtro.trim()}&quot;.
          </p>
        )}

        {!cargando && !errorCarga && negociosFiltrados.length > 0 && !seleccionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {negociosFiltrados.map((negocio) => (
              <button
                key={negocio.id}
                type="button"
                onClick={() => handleSeleccionar(negocio)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  boxShadow: shadows.card,
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <Building2 size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{negocio.name}</p>
                  <p style={{ fontSize: 12, color: colors.subtext, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{negocio.email}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.subtext, marginTop: 2 }}>
                    {negocio.subscription ? (
                      <>
                        <EstadoChip status={negocio.subscription.status} />
                        <span>vence {formatFechaCorta(negocio.subscription.ends_at)}</span>
                      </>
                    ) : negocio.is_exempt ? (
                      <span style={{ fontStyle: 'italic' }}>Exento</span>
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Sin suscripción</span>
                    )}
                  </span>
                </div>
                <RefreshCw size={16} color={colors.subtext} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {seleccionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ backgroundColor: colors.surface, borderRadius: 16, boxShadow: shadows.card, border: `1px solid ${colors.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Nombre</p>
                <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>{seleccionado.name}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Slug</p>
                <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>{seleccionado.slug}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Email</p>
                <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>{seleccionado.email}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 4px' }}>Estado actual</p>
                {seleccionado.subscription ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <EstadoChip status={seleccionado.subscription.status} />
                    <span style={{ fontSize: 14, color: colors.textStrong, fontWeight: 600 }}>
                      vence {formatFechaCorta(seleccionado.subscription.ends_at)}
                    </span>
                  </span>
                ) : seleccionado.is_exempt ? (
                  <p style={{ fontSize: 15, color: colors.subtext, fontStyle: 'italic', margin: 0 }}>Cuenta exenta</p>
                ) : (
                  <p style={{ fontSize: 15, color: colors.subtext, fontStyle: 'italic', margin: 0 }}>Sin suscripción</p>
                )}
              </div>
            </div>

            {!seleccionado.subscription ? (
              // Negocio sin suscripción: renewSubscription en el backend
              // 404-ea con "El usuario no tiene suscripción" para estas
              // cuentas (ver AGENTS de la task), así que no mostramos las
              // acciones — no aplican, sea por is_exempt o por cualquier otro
              // motivo de datos sin suscripción.
              <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: colors.surfaceSubtle }}>
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  Esta cuenta no tiene suscripción — no hay acciones disponibles.
                  {seleccionado.is_exempt && ' Exento.'}
                </p>
              </div>
            ) : resultado ? (
              <div style={{ backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center' }}>
                <CircleCheck size={26} color={colors.success} strokeWidth={1.5} />
                <p style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong, margin: 0 }}>{resultado.mensaje}</p>
                {resultado.endsAt && (
                  <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
                    Vencimiento: <strong style={{ color: colors.textStrong }}>{formatFechaCorta(resultado.endsAt)}</strong>
                  </p>
                )}
              </div>
            ) : (
              <>
                {errorAccion && (
                  <div role="alert" style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorAccion}</p>
                  </div>
                )}

                {conflicto && (
                  <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: colors.warningBg, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <TriangleAlert size={18} color={colors.warningFg} style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 13, color: colors.warningFg, margin: 0 }}>
                        Ya se renovó el {formatFechaCorta(conflicto.renewed_at)} (menos de 24hs). {conflicto.hint}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => ejecutarRenovacion(true)}
                        disabled={procesando}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 10,
                          backgroundColor: 'transparent',
                          border: `1px solid ${colors.warningFg}`,
                          color: colors.warningFg,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: procesando ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <RefreshCw size={14} />
                        {procesando ? 'Renovando…' : 'Renovar de todos modos'}
                      </button>
                      <button
                        type="button"
                        onClick={cerrarAccion}
                        disabled={procesando}
                        style={{ padding: '8px 14px', borderRadius: 10, backgroundColor: 'transparent', border: `1px solid ${colors.border}`, color: colors.textStrong, fontSize: 13, fontWeight: 600, cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {accionActiva === null && !conflicto && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button type="button" onClick={() => abrirAccion('renew')} style={btnPrimario}>
                      Renovar suscripción
                    </button>

                    {estadoActual !== 'SUSPENDIDO' && (
                      <button
                        type="button"
                        onClick={() => abrirAccion('suspend')}
                        style={{ ...btnPeligro, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <Ban size={16} />
                        Suspender
                      </button>
                    )}

                    {estadoActual === 'SUSPENDIDO' && (
                      <button
                        type="button"
                        onClick={() => abrirAccion('reactivate')}
                        style={{ ...btnPrimario, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <RotateCcw size={16} />
                        Reactivar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => abrirAccion('adjust')}
                      style={{ ...btnSecundario, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <CalendarClock size={16} />
                      Ajustar vencimiento
                    </button>
                  </div>
                )}

                {accionActiva === 'renew' && !conflicto && (
                  <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
                      ¿Confirmás renovar la suscripción de <strong>{seleccionado.name}</strong> ({seleccionado.slug})?
                      {seleccionado.subscription && (
                        <> Vence actualmente el <strong>{formatFechaCorta(seleccionado.subscription.ends_at)}</strong>.</>
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => ejecutarRenovacion(false)}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: procesando ? colors.primaryDisabled : colors.primarySolid, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        {procesando ? 'Renovando…' : 'Confirmar renovación'}
                      </button>
                      <button
                        type="button"
                        onClick={cerrarAccion}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, color: colors.textStrong, fontSize: 13, fontWeight: 600, border: `1px solid ${colors.border}`, cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {accionActiva === 'suspend' && (
                  <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
                      ¿Confirmás suspender la suscripción de <strong>{seleccionado.name}</strong> ({seleccionado.slug})?
                      El acceso se corta de inmediato y se dejan de enviar los mensajes de WhatsApp pagos. La fecha de vencimiento no cambia.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={ejecutarSuspension}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: 'transparent', color: colors.danger, fontSize: 13, fontWeight: 600, border: `1px solid ${colors.dangerBorder}`, cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        {procesando ? 'Suspendiendo…' : 'Confirmar suspensión'}
                      </button>
                      <button
                        type="button"
                        onClick={cerrarAccion}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, color: colors.textStrong, fontSize: 13, fontWeight: 600, border: `1px solid ${colors.border}`, cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {accionActiva === 'reactivate' && (
                  <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
                      ¿Confirmás reactivar la suscripción de <strong>{seleccionado.name}</strong> ({seleccionado.slug})?
                      Se restaura el acceso si el vencimiento sigue vigente; si ya pasó, queda como vencida hasta que se renueve.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={ejecutarReactivacion}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: procesando ? colors.primaryDisabled : colors.primarySolid, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        {procesando ? 'Reactivando…' : 'Confirmar reactivación'}
                      </button>
                      <button
                        type="button"
                        onClick={cerrarAccion}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, color: colors.textStrong, fontSize: 13, fontWeight: 600, border: `1px solid ${colors.border}`, cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {accionActiva === 'adjust' && (
                  <div style={{ backgroundColor: colors.surfaceSubtle, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
                      Nueva fecha de vencimiento para <strong>{seleccionado.name}</strong> ({seleccionado.slug}). El negocio mantiene el acceso hasta el final de ese día (horario de Argentina).
                    </p>
                    <input
                      type="date"
                      value={fechaAjuste}
                      onChange={(e) => setFechaAjuste(e.target.value)}
                      style={{
                        height: 44,
                        borderRadius: 10,
                        border: `1px solid ${validacionAjuste ? colors.dangerBorder : colors.border}`,
                        backgroundColor: colors.surface,
                        padding: '0 12px',
                        fontSize: 14,
                        color: colors.text,
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    {validacionAjuste && (
                      <p style={{ fontSize: 12, fontWeight: 500, color: colors.danger, margin: 0 }}>{validacionAjuste}</p>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={ejecutarAjuste}
                        disabled={procesando || !fechaAjuste}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: procesando || !fechaAjuste ? colors.primaryDisabled : colors.primarySolid, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: procesando || !fechaAjuste ? 'not-allowed' : 'pointer' }}
                      >
                        {procesando ? 'Guardando…' : 'Confirmar vencimiento'}
                      </button>
                      <button
                        type="button"
                        onClick={cerrarAccion}
                        disabled={procesando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, color: colors.textStrong, fontSize: 13, fontWeight: 600, border: `1px solid ${colors.border}`, cursor: procesando ? 'not-allowed' : 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                resetSeleccion();
              }}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: colors.subtext, fontSize: 13, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={14} />
              Volver a la lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
