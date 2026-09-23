'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, Wallet, ChevronDown, ChevronUp, CircleCheck, Copy } from 'lucide-react';
import { adminService, MercadoPagoNegocioConexion } from '@/services/adminService';
import { colors, shadows } from '@/theme/colors';

// Fase 1 de Mercado Pago: cada negocio tiene su PROPIA cuenta, cargada a
// mano por el equipo de Turnetto (sin OAuth propio — ver admin/whatsapp/
// page.tsx para el flujo con Embedded Signup, que se deja intacto porque
// esta pantalla NO lo reusa). Reemplaza cargar UserMpCredential por
// `artisan tinker` cada vez.

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined;
    return data?.message ?? fallback;
  }
  return fallback;
}

export default function MercadoPagoConexionesPage() {
  const [salones, setSalones] = useState<MercadoPagoNegocioConexion[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const respuesta = await adminService.obtenerConexionesMercadoPago();
      setSalones(respuesta.salones);
    } catch (e: unknown) {
      setSalones(null);
      setErrorCarga(extraerMensajeError(e, 'No se pudo cargar el estado de las conexiones.'));
    } finally {
      setCargando(false);
    }
  };

  // Fetch inicial al montar — mismo patrón que admin/whatsapp/page.tsx.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    cargar();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px',
        backgroundColor: colors.background,
      }}
    >
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: colors.subtext,
            textDecoration: 'none',
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>
            Mercado Pago por negocio
          </h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
            Fase 1: cargá a mano el access_token de la cuenta de Mercado Pago de cada negocio. Después
            pegá la URL del webhook en el panel de Mercado Pago del negocio (evento &quot;Order&quot;).
          </p>
        </div>

        {cargando && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>
            Cargando conexiones…
          </p>
        )}

        {errorCarga && !cargando && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.dangerBg,
              borderLeft: `4px solid ${colors.dangerBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorCarga}</p>
            <button
              type="button"
              onClick={cargar}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 14px',
                borderRadius: 10,
                border: `1px solid ${colors.dangerBorder}`,
                backgroundColor: 'transparent',
                color: colors.danger,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && salones && salones.length === 0 && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>
            No hay negocios registrados.
          </p>
        )}

        {!cargando && !errorCarga && salones && salones.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {salones.map((salon) => (
              <FilaNegocio key={salon.user_id} salon={salon} onGuardado={cargar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilaNegocio({ salon, onGuardado }: { salon: MercadoPagoNegocioConexion; onGuardado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [mpUserId, setMpUserId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookUrlNueva, setWebhookUrlNueva] = useState<string | null>(null);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const resultado = await adminService.conectarMercadoPago({
        user_id: salon.user_id,
        mp_access_token: accessToken.trim(),
        mp_user_id: mpUserId.trim(),
      });
      setWebhookUrlNueva(resultado.webhook_url);
      setAccessToken('');
      setMpUserId('');
      onGuardado();
    } catch (e: unknown) {
      setError(extraerMensajeError(e, 'No se pudo guardar la credencial.'));
    } finally {
      setGuardando(false);
    }
  };

  const webhookUrl = webhookUrlNueva ?? salon.webhook_url;

  return (
    <div
      style={{
        borderRadius: 14,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Wallet size={18} color={colors.primary} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.textStrong,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {salon.nombre}
          </p>
          <p style={{ fontSize: 12, color: colors.subtext, margin: '2px 0 0' }}>
            {salon.sena_monto ? `Seña: $${salon.sena_monto}` : 'Sin seña cargada'}
          </p>
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: salon.conectado ? colors.successBg : colors.surfaceSubtle,
            color: salon.conectado ? colors.success : colors.subtext,
            flexShrink: 0,
          }}
        >
          {salon.conectado ? 'Conectado' : 'Sin conectar'}
        </span>
        {abierto ? <ChevronUp size={16} color={colors.subtext} /> : <ChevronDown size={16} color={colors.subtext} />}
      </button>

      {abierto && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 1, backgroundColor: colors.border, margin: '0 0 4px' }} />

          {webhookUrl && (
            <CampoWebhookUrl url={webhookUrl} />
          )}

          <label style={{ fontSize: 12, fontWeight: 600, color: colors.subtext }}>
            {salon.conectado ? 'Rotar access_token' : 'access_token'}
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="APP_USR-..."
            autoComplete="off"
            style={campoEstilo}
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: colors.subtext }}>mp_user_id</label>
          <input
            type="text"
            value={mpUserId}
            onChange={(e) => setMpUserId(e.target.value)}
            placeholder={salon.mp_user_id ?? 'ID numérico de la cuenta de MP'}
            style={campoEstilo}
          />

          {error && (
            <p role="alert" style={{ fontSize: 13, color: colors.danger, margin: 0 }}>{error}</p>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !accessToken.trim() || !mpUserId.trim()}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              backgroundColor:
                guardando || !accessToken.trim() || !mpUserId.trim() ? colors.primaryDisabled : colors.primarySolid,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: guardando || !accessToken.trim() || !mpUserId.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {guardando ? 'Guardando…' : salon.conectado ? 'Actualizar credencial' : 'Guardar credencial'}
          </button>
        </div>
      )}
    </div>
  );
}

// Ese webhook_ruteo NUNCA cambia al rotar el token (ver
// MercadoPagoAdminController::store) — pegarla una vez en el panel de MP
// alcanza, no hay que volver a hacerlo cada vez que se actualiza el token.
function CampoWebhookUrl({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sin acceso al portapapeles: la URL sigue visible para copiar a mano
    }
  };

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: colors.subtext }}>
        URL del webhook (pegar en el panel de Mercado Pago, evento &quot;Order&quot;)
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input type="text" readOnly value={url} style={{ ...campoEstilo, flex: 1, color: colors.subtext }} />
        <button
          type="button"
          onClick={copiar}
          aria-label="Copiar URL del webhook"
          style={{
            flexShrink: 0,
            padding: '0 12px',
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceSubtle,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {copiado ? <CircleCheck size={14} color={colors.success} /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

const campoEstilo = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '9px 12px',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  fontSize: 13.5,
  color: colors.text,
  backgroundColor: colors.surface,
};
