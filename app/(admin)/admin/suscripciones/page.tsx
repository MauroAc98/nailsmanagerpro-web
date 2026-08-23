'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, Search, Building2, Mail, CircleCheck, TriangleAlert, RefreshCw } from 'lucide-react';
import { adminService, NegocioLookupResult, RenewSubscriptionResponse } from '@/services/adminService';
import { colors, shadows, withAlpha } from '@/theme/colors';

// Mismo formateo que app/(app)/perfil/page.tsx (formatFechaCorta) — no se
// extrajo a un helper compartido porque esta es la única otra pantalla que
// necesita fecha corta es-AR fuera de esa page.
function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// GET admin/negocios/buscar es búsqueda puntual (spec admin-subscription-
// renewal: "MUST NOT return a paginated/browsable list") — no un buscador
// incremental. Un submit de formulario dispara un único request, no
// debounce-on-keystroke.
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
  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<NegocioLookupResult[] | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const [seleccionado, setSeleccionado] = useState<NegocioLookupResult | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [renovado, setRenovado] = useState<RenewSubscriptionResponse | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoRenovacion | null>(null);
  const [errorRenovacion, setErrorRenovacion] = useState<string | null>(null);

  const resetSeleccion = () => {
    setSeleccionado(null);
    setConfirmando(false);
    setRenovando(false);
    setRenovado(null);
    setConflicto(null);
    setErrorRenovacion(null);
  };

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setBuscando(true);
    setErrorBusqueda(null);
    resetSeleccion();
    try {
      const data = await adminService.buscarNegocio(q);
      setResultados(data);
    } catch (e: unknown) {
      setResultados(null);
      setErrorBusqueda(extraerMensajeError(e, 'No se pudo buscar el negocio.'));
    } finally {
      setBuscando(false);
    }
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
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Buscá un negocio por email o slug para renovar su suscripción.</p>
        </div>

        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: 10, marginBottom: 24 }} noValidate>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              height: 54,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.card,
              borderRadius: 16,
              paddingLeft: 16,
              paddingRight: 16,
              gap: 12,
            }}
          >
            <Search size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="email@negocio.com o slug"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
            />
          </div>
          <button
            type="submit"
            disabled={buscando || !query.trim()}
            style={{
              height: 54,
              padding: '0 20px',
              borderRadius: 16,
              backgroundColor: buscando || !query.trim() ? colors.primaryDisabled : colors.primarySolid,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: buscando || !query.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {errorBusqueda && (
          <div role="alert" style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorBusqueda}</p>
          </div>
        )}

        {resultados !== null && resultados.length === 0 && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>
            No se encontró ningún negocio para &quot;{query.trim()}&quot;.
          </p>
        )}

        {resultados !== null && resultados.length > 0 && !seleccionado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resultados.map((negocio) => (
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
                }}
              >
                <Building2 size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: colors.textStrong, margin: 0 }}>{negocio.name}</p>
                  <p style={{ fontSize: 12, color: colors.subtext, margin: 0 }}>{negocio.slug} · {negocio.email}</p>
                </div>
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
                ) : (
                  <p style={{ fontSize: 15, color: colors.subtext, fontStyle: 'italic', margin: 0 }}>Sin suscripción</p>
                )}
              </div>
            </div>

            {renovado ? (
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
              <Mail size={14} />
              Buscar otro negocio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
