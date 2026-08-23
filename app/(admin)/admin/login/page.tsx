'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { colors, shadows, withAlpha } from '@/theme/colors';

// Pantalla interna de un solo administrador — sin next-intl (a diferencia
// de components/LoginScreen.tsx, que sirve a tenants en es/en/pt-BR): esta
// superficie nunca la ve una profesional, así que no justifica agregar un
// namespace de mensajes nuevo para esta fase. Copy en español neutro, igual
// idioma que el resto del código y comentarios del proyecto.
export default function AdminLoginPage() {
  const router = useRouter();
  const { login, loading, error, clearError } = useAdminAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    clearError();
    const ok = await login(email.trim().toLowerCase(), password);
    if (ok) router.push('/admin');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && password && !loading) handleLogin();
  };

  const fieldStyle = (field: 'email' | 'password') => ({
    display: 'flex',
    alignItems: 'center',
    height: 54,
    backgroundColor: colors.surface,
    border: `1px solid ${focusedField === field ? colors.primaryDeep : colors.border}`,
    boxShadow: focusedField === field ? `0 0 0 3px ${withAlpha(colors.primary, '33')}` : shadows.card,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: '32px 24px' }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: withAlpha(colors.primary, '22'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={26} color={colors.primaryDeep} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textStrong, margin: 0 }}>Panel de administración</h1>
          <p style={{ fontSize: 14, color: colors.subtext, margin: 0, textAlign: 'center' }}>Acceso restringido — solo administradores</p>
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="admin-email" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>Email</label>
            <div style={fieldStyle('email')}>
              <Mail size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
              <input
                id="admin-email"
                type="email"
                inputMode="email"
                placeholder="admin@turnetto.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="admin-password" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>Contraseña</label>
            <div style={fieldStyle('password')}>
              <Lock size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                autoComplete="current-password"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: colors.muted }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              height: 54,
              borderRadius: 16,
              backgroundColor: loading || !email || !password ? colors.primaryDisabled : colors.primarySolid,
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              border: 'none',
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              boxShadow: loading || !email || !password ? 'none' : `0 10px 24px ${withAlpha(colors.primarySolid, '3d')}`,
              transition: 'background-color 0.2s, box-shadow 0.2s',
            }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  );
}
