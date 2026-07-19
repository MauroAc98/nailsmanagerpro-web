'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { colors, shadows, withAlpha } from '@/theme/colors';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleEnviar = async () => {
    if (!email.trim()) return;
    clearError();
    const ok = await forgotPassword(email.trim().toLowerCase());
    if (ok) setEnviado(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && !loading && !enviado) {
      handleEnviar();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: '32px 24px' }}>

      {/* Botón Volver */}
      <div style={{ width: '100%', maxWidth: 360, marginBottom: 32 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.textStrong,
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Volver
        </button>
      </div>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 360, marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: withAlpha(colors.primary, '22'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill={colors.primary}/>
            <path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            <path d="M19.5 4.5 17 7h3V4.5"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 8 }}>
          ¿Olvidaste tu contraseña?
        </h2>

        <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.6, margin: 0 }}>
          Ingresá tu email y te enviaremos un código para restablecerla.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24, padding: '12px 16px', borderRadius: 8, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
          <p style={{ fontSize: 13, color: colors.danger, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Mensaje enviado */}
      {enviado && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24, padding: '12px 16px', borderRadius: 8, backgroundColor: colors.successBg, borderLeft: `4px solid ${colors.successBorder}` }}>
          <p style={{ fontSize: 13, color: colors.success, margin: 0 }}>
            Te enviamos un código a <strong>{email}</strong>. Revisá tu bandeja.
          </p>
        </div>
      )}

      {/* Formulario */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Email */}
        <div style={{ display: 'flex', alignItems: 'center', height: 52, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, boxShadow: shadows.card, borderRadius: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.muted} strokeWidth="1.8">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={enviado}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: colors.text,
              opacity: enviado ? 0.6 : 1,
            }}
          />
        </div>

        {/* Botón */}
        {!enviado ? (
          <button
            onClick={handleEnviar}
            disabled={loading || !email}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: loading || !email ? colors.primaryDisabled : colors.primary,
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: loading || !email ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        ) : (
          <button
            onClick={() => router.push('/reset-password?email=' + encodeURIComponent(email))}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Ingresar código
          </button>
        )}
      </div>
    </div>
  );
}
