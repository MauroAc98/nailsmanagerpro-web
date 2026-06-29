'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, forgotPassword, loading, error, clearError } = useAuth();

  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleReset = async () => {
    if (!code.trim() || !password || !passwordConfirmation) return;
    if (password !== passwordConfirmation) return;
    if (password.length < 8) return;

    clearError();
    const ok = await resetPassword({
      email,
      code: code.trim(),
      password,
      password_confirmation: passwordConfirmation,
    });

    if (ok) {
      router.push('/login');
    }
  };

  const handleReenviar = async () => {
    clearError();
    await forgotPassword(email.toLowerCase());
  };

  const valido = code.trim() && password && passwordConfirmation && password === passwordConfirmation && password.length >= 8;

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
            color: '#555',
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
          backgroundColor: colors.primary + '22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 8 }}>
          Revisá tu email
        </h2>

        <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.6, margin: 0 }}>
          Te enviamos un código de 6 dígitos a <br />
          <span style={{ fontWeight: 700, color: colors.text }}>{email}</span>
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24, padding: '12px 16px', borderRadius: 8, backgroundColor: '#fdecea', borderLeft: '4px solid #e57373' }}>
          <p style={{ fontSize: 13, color: '#c62828', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Formulario */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Código */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, display: 'block' }}>
            Código de verificación
          </label>
          <input
            type="text"
            placeholder="------"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 12,
              backgroundColor: '#f5f5f5',
              border: 'none',
              outline: 'none',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 10,
              textAlign: 'center',
              color: colors.text,
              padding: 0,
            }}
          />
        </div>

        {/* Nueva contraseña */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, display: 'block' }}>
            Nueva contraseña
          </label>
          <div style={{ display: 'flex', alignItems: 'center', height: 52, backgroundColor: '#f5f5f5', borderRadius: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 15,
                color: colors.text,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8">
                {showPassword
                  ? <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </>
                  : <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Confirmar contraseña */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, display: 'block' }}>
            Confirmar contraseña
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Repetí la contraseña"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 12,
              backgroundColor: '#f5f5f5',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              color: colors.text,
              padding: '0 16px',
            }}
          />
        </div>

        {/* Validaciones */}
        {password && passwordConfirmation && password !== passwordConfirmation && (
          <p style={{ color: '#e57373', fontSize: 13, margin: 0, marginTop: -8 }}>
            Las contraseñas no coinciden
          </p>
        )}

        {password && password.length < 8 && (
          <p style={{ color: '#e57373', fontSize: 13, margin: 0, marginTop: -8 }}>
            La contraseña debe tener al menos 8 caracteres
          </p>
        )}

        {/* Botón */}
        <button
          onClick={handleReset}
          disabled={loading || !valido}
          style={{
            height: 52,
            borderRadius: 12,
            backgroundColor: loading || !valido ? '#e0c4c7' : colors.primary,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: loading || !valido ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            marginTop: 8,
          }}
        >
          {loading ? 'Guardando...' : 'Restablecer contraseña'}
        </button>

        {/* Reenviar código */}
        <button
          onClick={handleReenviar}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 12,
            marginTop: -4,
          }}
        >
          <p style={{ fontSize: 13, color: colors.subtext, margin: 0 }}>
            ¿No recibiste el código?{' '}
            <span style={{ color: colors.primary, fontWeight: 700 }}>Reenviar</span>
          </p>
        </button>
      </div>
    </div>
  );
}