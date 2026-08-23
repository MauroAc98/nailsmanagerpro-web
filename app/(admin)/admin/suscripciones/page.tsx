'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, Search, Building2, X, CircleCheck, TriangleAlert, RefreshCw } from 'lucide-react';
import { adminService, NegocioLookupResult, RenewSubscriptionResponse } from '@/services/adminService';
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

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    return e.response?.data?.error ?? e.response?.data?.message ?? fallback;
  }
  return fallback;
}

export default function SuscripcionesPage() {
  const [negocios, setNegocios] = useState<NegocioLookupResult[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const [seleccionado, setSeleccionado] = useState<NegocioLookupResult | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [renovado, setRenovado] = useState<RenewSubscriptionResponse | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoRenovacion | null>(null);
  const [errorRenovacion, setErrorRenovacion] = useState<string | null>(null);

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
    setConfirmando(false);
    setRenovando(false);
    setRenovado(null);
    setConflicto(null);
    setErrorRenovacion(null);
  };

  const handleSeleccionar = (negocio: NegocioLookupResult) => {
    resetSeleccion();
    setSeleccionado(negocio);
  };

  // Task 5.2: identity card + "confirm-before-write step" — el click en
  // "Renovar" solo abre el paso de confirmación, todavía no dispara el POST.
  const handlePedirConfirmacion = () => {
    setConfirmando(true);
    setErrorRenovacion(null);
    setConflicto(null);
  };

  const ejecutarRenovacion = async (force: boolean) => {
    if (!seleccionado) return;
    setRenovando(true);
    setErrorRenovacion(null);
    setConflicto(null);
    try {
      const response = await adminService.renovarSuscripcion(seleccionado.id, force);
      setRenovado(response);
      setConfirmando(false);
      // Refresco silencioso de la lista en segundo plano: la card de éxito
      // sigue mostrándose (seleccionado no se toca), pero al volver a la
      // lista el ends_at/status ya reflejan la renovación recién hecha.
      cargarNegocios();
    } catch (e: unknown) {
      // 409 = ya renovada dentro de la ventana de 24hs (AdminController::
      // renewSubscription) — se ofrece "force" en vez de mostrarlo como un
      // error genérico, ver spec "Duplicate renewal within dedup window".
      if (isAxiosError(e) && e.response?.status === 409) {
        setConflicto(e.response.data as ConflictoRenovacion);
      } else {
        setErrorRenovacion(extraerMensajeError(e, 'No se pudo renovar la suscripción.'));
      }
    } finally {
      setRenovando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/admin"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Suscripciones</h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Elegí un negocio de la lista para renovar su suscripción.</p>
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
                  <p style={{ fontSize: 12, color: colors.subtext, margin: '2px 0 0' }}>
                    {negocio.subscription ? (
                      <>{negocio.subscription.status} · vence {formatFechaCorta(negocio.subscription.ends_at)}</>
                    ) : negocio.is_exempt ? (
                      <span style={{ fontStyle: 'italic' }}>Exento</span>
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Sin suscripción</span>
                    )}
                  </p>
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
                <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Estado actual</p>
                {seleccionado.subscription ? (
                  <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>
                    {seleccionado.subscription.status} · vence {formatFechaCorta(seleccionado.subscription.ends_at)}
                  </p>
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
              // cuentas (ver AGENTS de la task), así que no mostramos el
              // flujo de renovación — no aplica, sea por is_exempt o por
              // cualquier otro motivo de datos sin suscripción.
              <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: colors.surfaceSubtle }}>
                <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
                  Esta cuenta no tiene suscripción — no aplica renovación.
                  {seleccionado.is_exempt && ' Exento.'}
                </p>
              </div>
            ) : renovado ? (
              <div style={{ backgroundColor: colors.successBg, border: `1px solid ${colors.successBorder}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', textAlign: 'center' }}>
                <CircleCheck size={26} color={colors.success} strokeWidth={1.5} />
                <p style={{ fontSize: 15, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Suscripción renovada</p>
                <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
                  Nueva fecha de vencimiento: <strong style={{ color: colors.textStrong }}>{formatFechaCorta(renovado.ends_at)}</strong>
                </p>
              </div>
            ) : (
              <>
                {errorRenovacion && (
                  <div role="alert" style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorRenovacion}</p>
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
                    <button
                      type="button"
                      onClick={() => ejecutarRenovacion(true)}
                      disabled={renovando}
                      style={{
                        alignSelf: 'flex-start',
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
                        cursor: renovando ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <RefreshCw size={14} />
                      {renovando ? 'Renovando…' : 'Renovar de todos modos'}
                    </button>
                  </div>
                )}

                {!confirmando && !conflicto && (
                  <button
                    type="button"
                    onClick={handlePedirConfirmacion}
                    style={{ height: 50, borderRadius: 14, backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Renovar suscripción
                  </button>
                )}

                {confirmando && !conflicto && (
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
                        disabled={renovando}
                        style={{
                          flex: 1,
                          height: 46,
                          borderRadius: 12,
                          backgroundColor: renovando ? colors.primaryDisabled : colors.primarySolid,
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          border: 'none',
                          cursor: renovando ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {renovando ? 'Renovando…' : 'Confirmar renovación'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(false)}
                        disabled={renovando}
                        style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: colors.surface, color: colors.textStrong, fontSize: 13, fontWeight: 600, border: `1px solid ${colors.border}`, cursor: renovando ? 'not-allowed' : 'pointer' }}
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
