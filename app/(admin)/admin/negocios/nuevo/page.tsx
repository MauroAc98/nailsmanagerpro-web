'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { ArrowLeft, Building2, Mail, User, KeyRound, Copy, Check, CircleCheck } from 'lucide-react';
import { adminService, CrearNegocioPayload, CrearNegocioResponse } from '@/services/adminService';
import { colors, shadows, withAlpha } from '@/theme/colors';

// Excluye is_exempt: no es un campo de texto con label/validación como los
// demás, se maneja aparte via el checkbox y el estado esExento.
type Campo = keyof Omit<CrearNegocioPayload, 'is_exempt'>;

const CAMPOS_VACIOS: CrearNegocioPayload = {
  name: '',
  email: '',
  profesional_nombre: '',
  profesional_apellido: '',
};

const ETIQUETAS: Record<Campo, string> = {
  name: 'Nombre del negocio',
  email: 'Email',
  profesional_nombre: 'Nombre del profesional',
  profesional_apellido: 'Apellido del profesional',
};

// Mismo criterio que services/clienteService.ts (extraerMensajeError): Laravel
// devuelve el detalle por campo bajo `errors.<campo>[0]`, el `message` de
// nivel superior es el genérico de ValidationException. A diferencia de esa
// función no usamos next-intl acá (ver Phase 3 Deviations — el panel admin
// no tiene namespace de mensajes propio), así que el fallback queda en
// español neutro hardcodeado, igual que el resto de esta superficie.
function extraerErroresDeCampo(e: unknown): Partial<Record<Campo, string>> {
  if (isAxiosError(e)) {
    const errores = e.response?.data?.errors as Record<string, string[]> | undefined;
    if (errores) {
      const resultado: Partial<Record<Campo, string>> = {};
      for (const campo of Object.keys(ETIQUETAS) as Campo[]) {
        const primerMensaje = errores[campo]?.[0];
        if (primerMensaje) resultado[campo] = primerMensaje;
      }
      return resultado;
    }
  }
  return {};
}

function extraerMensajeGeneral(e: unknown): string {
  if (isAxiosError(e)) {
    return e.response?.data?.message ?? 'No se pudo crear el negocio.';
  }
  return 'No se pudo crear el negocio.';
}

export default function NuevoNegocioPage() {
  const [valores, setValores] = useState<CrearNegocioPayload>(CAMPOS_VACIOS);
  const [erroresDeCampo, setErroresDeCampo] = useState<Partial<Record<Campo, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<CrearNegocioResponse | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [focusedField, setFocusedField] = useState<Campo | null>(null);
  const [esExento, setEsExento] = useState(false);

  const handleChange = (campo: Campo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValores((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  // Requerido por spec (admin-tenant-provisioning): ningún campo vacío llega
  // al backend — si falta algo, ni siquiera se dispara el request.
  const validarLocal = (): boolean => {
    const faltantes: Partial<Record<Campo, string>> = {};
    for (const campo of Object.keys(ETIQUETAS) as Campo[]) {
      if (!valores[campo].trim()) faltantes[campo] = 'Este campo es obligatorio.';
    }
    setErroresDeCampo(faltantes);
    return Object.keys(faltantes).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGeneral(null);
    if (!validarLocal()) return;

    setEnviando(true);
    try {
      const payload: CrearNegocioPayload = {
        name: valores.name.trim(),
        email: valores.email.trim().toLowerCase(),
        profesional_nombre: valores.profesional_nombre.trim(),
        profesional_apellido: valores.profesional_apellido.trim(),
        ...(esExento ? { is_exempt: true } : {}),
      };
      const response = await adminService.crearNegocio(payload);
      setResultado(response);
      setErroresDeCampo({});
    } catch (e: unknown) {
      // Falla de validación (ej. email duplicado) o cualquier otro error: el
      // backend valida ANTES de escribir nada (ver AdminController::
      // crearNegocio), así que no queda cuenta parcial creada.
      const camposConError = extraerErroresDeCampo(e);
      if (Object.keys(camposConError).length > 0) {
        setErroresDeCampo(camposConError);
      } else {
        setErrorGeneral(extraerMensajeGeneral(e));
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleCrearOtro = () => {
    setResultado(null);
    setValores(CAMPOS_VACIOS);
    setErroresDeCampo({});
    setErrorGeneral(null);
    setCopiado(false);
    setEsExento(false);
  };

  const handleCopiarPassword = async () => {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.password_provisoria);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard API puede no estar disponible (contexto no seguro,
      // permiso denegado) — la contraseña sigue visible en pantalla para
      // copiarla a mano, no bloqueamos el flujo por esto.
    }
  };

  const fieldStyle = (campo: Campo) => ({
    display: 'flex',
    alignItems: 'center',
    height: 54,
    backgroundColor: colors.surface,
    border: `1px solid ${erroresDeCampo[campo] ? colors.dangerBorder : focusedField === campo ? colors.primaryDeep : colors.border}`,
    boxShadow: focusedField === campo ? `0 0 0 3px ${withAlpha(colors.primary, '33')}` : shadows.card,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  });

  if (resultado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircleCheck size={26} color={colors.success} strokeWidth={1.5} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Negocio creado</h1>
            <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>
              Compartí estas credenciales con la dueña del negocio para su primer ingreso.
            </p>
          </div>

          <div style={{ backgroundColor: colors.surface, borderRadius: 16, boxShadow: shadows.card, border: `1px solid ${colors.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Nombre</p>
              <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>{resultado.user.name}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Slug</p>
              <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>{resultado.user.slug}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 2px' }}>Email</p>
              <p style={{ fontSize: 15, color: colors.textStrong, fontWeight: 600, margin: 0 }}>{resultado.user.email}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: colors.subtext, margin: '0 0 6px' }}>Contraseña provisoria</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceSubtle, borderRadius: 12, padding: '10px 14px' }}>
                <KeyRound size={16} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontFamily: 'monospace', color: colors.textStrong, flex: 1, userSelect: 'all' }}>
                  {resultado.password_provisoria}
                </span>
                <button
                  type="button"
                  onClick={handleCopiarPassword}
                  aria-label="Copiar contraseña"
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: copiado ? colors.success : colors.muted }}
                >
                  {copiado ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: colors.subtext, margin: 0, textAlign: 'center' }}>
            También se envió esta contraseña por email a {resultado.user.email} — esta pantalla queda como respaldo si el correo no llega.
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={handleCrearOtro}
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.primarySolid, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Crear otro negocio
            </button>
            <Link
              href="/"
              style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.surface, color: colors.textStrong, fontSize: 14, fontWeight: 600, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            >
              Volver al panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px', backgroundColor: colors.background }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.subtext, textDecoration: 'none', marginBottom: 20 }}
        >
          <ArrowLeft size={16} />
          Volver al panel
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Crear negocio</h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0 }}>Alta de un nuevo negocio y su profesional titular.</p>
        </div>

        {errorGeneral && (
          <div role="alert" style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{errorGeneral}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="negocio-name" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{ETIQUETAS.name}</label>
            <div style={fieldStyle('name')}>
              <Building2 size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
              <input
                id="negocio-name"
                type="text"
                placeholder="Nombre del salón"
                value={valores.name}
                onChange={handleChange('name')}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
              />
            </div>
            {erroresDeCampo.name && <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>{erroresDeCampo.name}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="negocio-email" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{ETIQUETAS.email}</label>
            <div style={fieldStyle('email')}>
              <Mail size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
              <input
                id="negocio-email"
                type="email"
                inputMode="email"
                placeholder="negocio@ejemplo.com"
                value={valores.email}
                onChange={handleChange('email')}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                autoCorrect="off"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
              />
            </div>
            {erroresDeCampo.email && <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>{erroresDeCampo.email}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="negocio-profesional-nombre" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{ETIQUETAS.profesional_nombre}</label>
            <div style={fieldStyle('profesional_nombre')}>
              <User size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
              <input
                id="negocio-profesional-nombre"
                type="text"
                placeholder="Nombre"
                value={valores.profesional_nombre}
                onChange={handleChange('profesional_nombre')}
                onFocus={() => setFocusedField('profesional_nombre')}
                onBlur={() => setFocusedField(null)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
              />
            </div>
            {erroresDeCampo.profesional_nombre && <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>{erroresDeCampo.profesional_nombre}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="negocio-profesional-apellido" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>{ETIQUETAS.profesional_apellido}</label>
            <div style={fieldStyle('profesional_apellido')}>
              <User size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
              <input
                id="negocio-profesional-apellido"
                type="text"
                placeholder="Apellido"
                value={valores.profesional_apellido}
                onChange={handleChange('profesional_apellido')}
                onFocus={() => setFocusedField('profesional_apellido')}
                onBlur={() => setFocusedField(null)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
              />
            </div>
            {erroresDeCampo.profesional_apellido && <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>{erroresDeCampo.profesional_apellido}</p>}
          </div>

          <label
            htmlFor="negocio-exento"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 14, backgroundColor: colors.surfaceSubtle, cursor: 'pointer' }}
          >
            <input
              id="negocio-exento"
              type="checkbox"
              checked={esExento}
              onChange={(e) => setEsExento(e.target.checked)}
              style={{ flexShrink: 0, width: 18, height: 18, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: colors.text }}>
              Cuenta exenta de suscripción (sin período de prueba)
            </span>
          </label>

          <button
            type="submit"
            disabled={enviando}
            style={{
              height: 54,
              borderRadius: 16,
              backgroundColor: enviando ? colors.primaryDisabled : colors.primarySolid,
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: enviando ? 'not-allowed' : 'pointer',
              boxShadow: enviando ? 'none' : `0 10px 24px ${withAlpha(colors.primarySolid, '3d')}`,
              transition: 'background-color 0.2s, box-shadow 0.2s',
            }}
          >
            {enviando ? 'Creando…' : 'Crear negocio'}
          </button>
        </form>
      </div>
    </div>
  );
}
