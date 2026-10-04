'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useAdminAuthStore } from '@/store/useAdminAuthStore';
import { colors, shadows, withAlpha } from '@/theme/colors';

// Reemplaza el viejo flujo de "401 -> borra sesión -> redirect a /login",
// que desmontaba la pantalla actual y con ella cualquier formulario sin
// guardar (feedback 2026-10-02: completás el alta de un negocio, el token
// vence mientras escribís, le das Guardar y perdés todo lo tipeado).
//
// Se monta en app/(admin)/admin/layout.tsx junto a `children` (nunca en su
// lugar) cuando useAdminAuthStore.reautenticacionRequerida es true. La
// pantalla de atrás sigue montada —y su estado local intacto— mientras este
// modal pide la contraseña de nuevo. Si el reingreso funciona, el modal se
// cierra solo (login() limpia el flag) y lo que estaba escribiendo sigue ahí
// para reintentar guardar. "Cerrar sesión" es la única vía que sí abandona
// la pantalla, y es una decisión explícita del usuario, no un efecto
// colateral de un request fallido.
export function AdminReauthModal() {
  const router = useRouter();
  const { admin, login, logout, loading, error, clearError } = useAdminAuthStore();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleReingresar = async () => {
    if (!admin?.email || !password) return;
    clearError();
    await login(admin.email, password);
    // En éxito, login() ya puso reautenticacionRequerida=false — el modal
    // se desmonta solo en el próximo render. En error, el mensaje queda en
    // `error` y el modal sigue abierto para reintentar.
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password && !loading) handleReingresar();
  };

  const handleCerrarSesion = async () => {
    // logout() puede rechazar (el POST a /admin/logout 401 porque el token
    // ya está vencido — justo el caso que nos trajo acá). El store igual
    // limpia admin/token/reautenticacionRequerida en su `finally`; lo único
    // que nos importa es no dejar de navegar por ese rechazo.
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Sesión expirada"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 340,
          margin: '0 20px',
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: '24px 22px calc(22px + env(safe-area-inset-bottom))',
          boxShadow: shadows.card,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: withAlpha(colors.danger, '22'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color={colors.danger} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.textStrong, margin: 0, textAlign: 'center' }}>
            Tu sesión expiró
          </h2>
          <p style={{ fontSize: 13, color: colors.subtext, margin: 0, textAlign: 'center' }}>
            Lo que tenías sin guardar en esta pantalla sigue ahí. Ingresá tu contraseña para seguir.
          </p>
        </div>

        {error && (
          <div role="alert" style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 12, backgroundColor: colors.dangerBg, borderLeft: `4px solid ${colors.dangerBorder}` }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: colors.danger, margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <label htmlFor="reauth-password" style={{ fontSize: 13, fontWeight: 600, color: colors.textStrong }}>
            Contraseña — {admin?.email}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', height: 50, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, paddingLeft: 14, paddingRight: 14, gap: 10 }}>
            <Lock size={17} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
            <input
              id="reauth-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              autoComplete="current-password"
              autoFocus
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: colors.text }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: colors.muted }}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button
          onClick={handleReingresar}
          disabled={loading || !password}
          style={{
            width: '100%',
            height: 50,
            borderRadius: 14,
            backgroundColor: loading || !password ? colors.primaryDisabled : colors.primarySolid,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            cursor: loading || !password ? 'not-allowed' : 'pointer',
            marginBottom: 10,
          }}
        >
          {loading ? 'Ingresando…' : 'Reingresar'}
        </button>

        <button
          onClick={handleCerrarSesion}
          disabled={loading}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 14,
            backgroundColor: 'transparent',
            color: colors.subtext,
            fontSize: 13,
            fontWeight: 500,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
