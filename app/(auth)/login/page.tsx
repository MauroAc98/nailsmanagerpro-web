'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error, clearError, debeCambiarPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    clearError();
    const ok = await login(email.trim().toLowerCase(), password);
    if (ok) {
      router.push(debeCambiarPassword ? '/cambiar-password' : '/agenda');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && password && !loading) {
      handleLogin();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: '0 24px' }}>

      {/* Header con logo */}
      <div style={{ marginBottom: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Image
          src="/icon-192.png"
          alt="NailsManagerPro"
          width={120}
          height={120}
          style={{ marginBottom: 12 }}
        />
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: colors.text, margin: 0, marginBottom: 4 }}>
          NailsManagerPro
        </h1>
        <p style={{ fontSize: 13, color: '#BBB', margin: 0, letterSpacing: 0.2 }}>
          Día a día, sin perder el control
        </p>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, backgroundColor: colors.primary + '22', width: '100%', maxWidth: 360, marginBottom: 24 }} />

      {/* Error */}
      {error && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24, padding: '12px 16px', borderRadius: 8, backgroundColor: '#fdecea', borderLeft: '4px solid #e57373' }}>
          <p style={{ fontSize: 14, color: '#c62828', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Formulario */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#555', margin: 0, marginLeft: 2 }}>Email</p>
          <div style={{ display: 'flex', alignItems: 'center', height: 52, backgroundColor: '#FFF', border: '1px solid #EEE', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary + 'aa'} strokeWidth="1.8">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
            />
          </div>
        </div>

        {/* Contraseña */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#555', margin: 0, marginLeft: 2 }}>Contraseña</p>
          <div style={{ display: 'flex', alignItems: 'center', height: 52, backgroundColor: '#FFF', border: '1px solid #EEE', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderRadius: 12, paddingLeft: 16, paddingRight: 16, gap: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.primary + 'aa'} strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              autoComplete="current-password"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Olvidé contraseña */}
        <div style={{ textAlign: 'right', marginTop: -4 }}>
          <button
            onClick={() => router.push('/forgot-password')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontSize: 13, fontWeight: 600, padding: 0 }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {/* Botón Ingresar */}
        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{
            height: 52,
            borderRadius: 14,
            backgroundColor: loading || !email || !password ? '#e0c4c7' : colors.primary,
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>

      {/* Footer legal */}
      <button
        onClick={() => router.push('/legal')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBB', fontSize: 12, marginTop: 28, padding: 8 }}
      >
        Términos y condiciones
      </button>
    </div>
  );
}
