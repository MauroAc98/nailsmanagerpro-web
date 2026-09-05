'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, MessageCircle, Link2, RefreshCw, CircleCheck, TriangleAlert } from 'lucide-react';
import {
  adminService,
  WhatsappConexionesResponse,
  WhatsappNegocioConexion,
  WhatsappConexionEstado,
} from '@/services/adminService';
import FacebookSdkScript from '@/components/admin/FacebookSdkScript';
import { useEmbeddedSignup, DatosEmbeddedSignup } from '@/hooks/useEmbeddedSignup';
import { confirmDialog } from '@/store/useConfirmStore';
import { colors, shadows, withAlpha } from '@/theme/colors';

function extraerMensajeError(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    const status = e.response?.status;
    const data = e.response?.data as
      | { message?: string; salon_dueno?: { name?: string } | null }
      | undefined;

    if (status === 409) {
      const dueno = data?.salon_dueno?.name;
      return dueno
        ? `Ese número de WhatsApp ya está vinculado a otro negocio (${dueno}). Hay que desvincularlo antes de reasignarlo.`
        : 'Ese número de WhatsApp ya está vinculado a otro negocio.';
    }
    if (status === 403) {
      return data?.message ?? 'El onboarding de WhatsApp todavía no está habilitado para este negocio.';
    }
    return data?.message ?? fallback;
  }
  return fallback;
}

// Aviso de facturación previo a Embedded Signup (spec: whatsapp-billing-disclosure).
// Panel admin sin namespace de next-intl propio (mismo criterio que
// admin/negocios/nuevo/page.tsx) — texto en español neutro hardcodeado.
// Las 4 obligaciones de la spec deben quedar explícitas en el mismo texto:
// (1) nombra el negocio, (2) la facturación pasa a Meta directamente,
// (3) el negocio debe cargar su propio método de pago en Meta Business
// Manager o sus mensajes dejan de enviarse, (4) Turnetto deja de pagar los
// mensajes de ese negocio desde ese momento.
function mensajeAvisoFacturacion(nombre: string): string {
  return (
    `Vas a conectar el WhatsApp de ${nombre} directo con Meta: a partir de ahora, ` +
    `los mensajes de este negocio se facturan a la cuenta de Meta Business Manager ` +
    `de ${nombre}, no a Turnetto. El negocio tiene que cargar su propio método de ` +
    `pago en Meta Business Manager — si no lo hace, sus mensajes de WhatsApp van a ` +
    `dejar de enviarse. Turnetto deja de pagar los mensajes de este negocio desde ` +
    `este momento.`
  );
}

const ETIQUETA_ESTADO: Record<WhatsappConexionEstado, string> = {
  sin_conexion: 'Sin conexión',
  conectada: 'Conectada',
  por_vencer: 'Por vencer',
  expirada: 'Expirada',
};

function coloresChip(estado: WhatsappConexionEstado): { bg: string; fg: string } {
  switch (estado) {
    case 'conectada':
      return { bg: colors.successBg, fg: colors.success };
    case 'por_vencer':
      return { bg: colors.warningBg, fg: colors.warningFg };
    case 'expirada':
      return { bg: colors.dangerBg, fg: colors.danger };
    default:
      return { bg: colors.surfaceSubtle, fg: colors.subtext };
  }
}

export default function WhatsappConexionesPage() {
  const [datos, setDatos] = useState<WhatsappConexionesResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [sdkListo, setSdkListo] = useState(false);
  const [sdkError, setSdkError] = useState(false);

  // Negocio cuyo botón se apretó — dispara el spinner de esa fila y define el
  // user_id que viaja en el POST.
  const [negocioEnCurso, setNegocioEnCurso] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorConexion, setErrorConexion] = useState<string | null>(null);
  const [exitoUserId, setExitoUserId] = useState<number | null>(null);

  const exitoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (exitoTimerRef.current) clearTimeout(exitoTimerRef.current);
    },
    [],
  );

  const cargar = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const respuesta = await adminService.obtenerConexionesWhatsapp();
      setDatos(respuesta);
    } catch (e: unknown) {
      setDatos(null);
      setErrorCarga(extraerMensajeError(e, 'No se pudo cargar el estado de las conexiones.'));
    } finally {
      setCargando(false);
    }
  };

  // Fetch inicial al montar — mismo patrón que suscripciones/page.tsx.
  /* eslint-disable react-hooks/set-state-in-effect -- fetch inicial de las
     conexiones al montar, ver suscripciones/page.tsx para el porqué. */
  useEffect(() => {
    cargar();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const es = datos?.es ?? null;
  const configId = es?.config_id ?? null;
  const appId = es?.app_id ?? null;
  const graphVersion = es?.graph_version ?? 'v26.0';

  const intercambiar = async (payload: DatosEmbeddedSignup) => {
    setGuardando(true);
    setErrorConexion(null);
    try {
      await adminService.conectarWhatsapp(payload);
      setExitoUserId(payload.user_id);
      if (exitoTimerRef.current) clearTimeout(exitoTimerRef.current);
      exitoTimerRef.current = setTimeout(() => setExitoUserId(null), 4000);
      await cargar();
    } catch (e: unknown) {
      setErrorConexion(extraerMensajeError(e, 'No se pudo conectar el número de WhatsApp.'));
    } finally {
      setGuardando(false);
      setNegocioEnCurso(null);
    }
  };

  const { estado: estadoSignup, error: errorSignup, iniciar, reset } = useEmbeddedSignup({
    configId,
    sdkListo,
    onCompleto: intercambiar,
  });

  const puedeConectar =
    !!es && es.enabled && !!appId && !!configId && sdkListo && !sdkError && !guardando;

  // Gate de facturación (spec: whatsapp-billing-disclosure) — el aviso debe
  // ser lo PRIMERO que corre, antes de mutar cualquier estado, y Embedded
  // Signup (iniciar/FB.login) sólo se dispara si el operador confirma.
  const handleConectar = async (userId: number, nombre: string) => {
    const confirmado = await confirmDialog(mensajeAvisoFacturacion(nombre), {
      confirmText: 'Entiendo, conectar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!confirmado) return;

    setErrorConexion(null);
    setExitoUserId(null);
    reset();
    setNegocioEnCurso(userId);
    iniciar(userId);
  };

  const negocios = useMemo(() => datos?.salones ?? [], [datos]);

  const mensajeSignup =
    estadoSignup === 'esperando'
      ? 'Se abrió la ventana de Facebook. Completá los pasos y no cierres esta pestaña.'
      : estadoSignup === 'cancelado'
        ? 'Conexión cancelada. Podés volver a intentarlo cuando quieras.'
        : null;

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
      {appId && es?.enabled && (
        <FacebookSdkScript
          appId={appId}
          graphVersion={graphVersion}
          onReady={() => {
            setSdkListo(true);
            setSdkError(false);
          }}
          onError={() => setSdkError(true)}
        />
      )}

      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column' }}>
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
            WhatsApp por negocio
          </h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
            Conectá el número propio de WhatsApp Business de cada negocio mediante Embedded Signup.
          </p>
        </div>

        {es && !es.enabled && (
          <div
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.warningBg,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <TriangleAlert size={18} color={colors.warningFg} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: colors.warningFg, margin: 0 }}>
              El onboarding de WhatsApp está deshabilitado. Podés ver el estado de cada negocio, pero
              todavía no se puede conectar un número nuevo.
            </p>
          </div>
        )}

        {sdkError && es?.enabled && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.dangerBg,
              borderLeft: `4px solid ${colors.dangerBorder}`,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>
              No se pudo cargar el SDK de Facebook. Revisá la conexión y recargá la página.
            </p>
          </div>
        )}

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

        {mensajeSignup && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.surfaceSubtle,
            }}
          >
            <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>{mensajeSignup}</p>
          </div>
        )}

        {errorSignup && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.dangerBg,
              borderLeft: `4px solid ${colors.dangerBorder}`,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorSignup}</p>
          </div>
        )}

        {errorConexion && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.dangerBg,
              borderLeft: `4px solid ${colors.dangerBorder}`,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorConexion}</p>
          </div>
        )}

        {guardando && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: colors.surfaceSubtle,
            }}
          >
            <p style={{ fontSize: 13, color: colors.text, margin: 0 }}>
              Conectando el número… puede tardar hasta un minuto. No cierres esta pestaña.
            </p>
          </div>
        )}

        {!cargando && !errorCarga && negocios.length === 0 && (
          <p style={{ fontSize: 14, color: colors.subtext, textAlign: 'center', padding: '16px 0' }}>
            No hay negocios registrados.
          </p>
        )}

        {!cargando && !errorCarga && negocios.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {negocios.map((negocio) => (
              <FilaNegocio
                key={negocio.user_id}
                negocio={negocio}
                puedeConectar={puedeConectar}
                enCurso={negocioEnCurso === negocio.user_id && (guardando || estadoSignup === 'esperando')}
                exito={exitoUserId === negocio.user_id}
                onConectar={() => handleConectar(negocio.user_id, negocio.nombre)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface FilaNegocioProps {
  negocio: WhatsappNegocioConexion;
  puedeConectar: boolean;
  enCurso: boolean;
  exito: boolean;
  onConectar: () => void;
}

function FilaNegocio({ negocio, puedeConectar, enCurso, exito, onConectar }: FilaNegocioProps) {
  const chip = coloresChip(negocio.estado);
  const yaConectado = negocio.estado !== 'sin_conexion';
  const etiquetaBoton = yaConectado ? 'Reconectar' : 'Conectar';
  const deshabilitado = !puedeConectar || enCurso;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.card,
        boxSizing: 'border-box',
      }}
    >
      <MessageCircle size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
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
          {negocio.nombre}
        </p>
        <p
          style={{
            fontSize: 12,
            color: colors.subtext,
            margin: '2px 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {negocio.verified_name
            ? `${negocio.verified_name}${negocio.display_phone_number ? ` · ${negocio.display_phone_number}` : ''}`
            : negocio.display_phone_number ?? 'Número no conectado'}
        </p>
        <span
          style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: chip.bg,
            color: chip.fg,
          }}
        >
          {ETIQUETA_ESTADO[negocio.estado]}
        </span>
      </div>

      {exito ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: colors.success,
            flexShrink: 0,
          }}
        >
          <CircleCheck size={16} />
          Conectado
        </span>
      ) : (
        <button
          type="button"
          onClick={onConectar}
          disabled={deshabilitado}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: deshabilitado ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: deshabilitado ? 'not-allowed' : 'pointer',
          }}
        >
          {yaConectado ? <RefreshCw size={14} /> : <Link2 size={14} />}
          {enCurso ? 'Conectando…' : etiquetaBoton}
        </button>
      )}
    </div>
  );
}
