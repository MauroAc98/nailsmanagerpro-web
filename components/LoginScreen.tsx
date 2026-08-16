'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Mail, Lock, Eye, EyeOff, Store } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { colors, withAlpha } from '@/theme/colors';
import { agendaColors, agendaShadows, agendaFontSerif } from '@/theme/agendaColors';
import { useThemeStore } from '@/store/useThemeStore';
import { authService, type NegocioBranding } from '@/services/authService';

interface LoginScreenProps {
  // Presente solo cuando se entra por /login/{slug} — dispara el fetch del
  // branding público del negocio. Sin slug (/login a secas, el link
  // genérico compartido hoy) siempre queda en el placeholder.
  slug?: string;
}

// Techo de altura del logo del negocio — evita que un logo con proporción
// muy vertical empuje el formulario fuera de la pantalla.
const LOGO_MAX_HEIGHT = 260;

export function LoginScreen({ slug }: LoginScreenProps) {
  const t = useTranslations('auth.LoginPage');
  const router = useRouter();
  const { login, loading, error, clearError } = useAuth();
  // Login no vive bajo app/(app)/agenda, así que no hereda la clase
  // agenda-light/agenda-dark de ahí — se aplica acá mismo para poder leer
  // la paleta cálida del rediseño (--ag-*) en vez del gris frío global.
  const resolvedTheme = useThemeStore(s => s.resolvedTheme);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [branding, setBranding] = useState<NegocioBranding | null>(null);

  useEffect(() => {
    // Sin slug en la URL (ej. la PWA instalada, que siempre abre en /login
    // por el start_url fijo del manifest — ver KEYS.negocioSlug en
    // authService.ts) cae al último slug recordado en este dispositivo.
    const slugEfectivo = slug ?? authService.getSlugNegocioGuardado();
    if (!slugEfectivo) return;
    if (slug) authService.guardarSlugNegocio(slug);

    let cancelado = false;
    authService.obtenerBrandingNegocio(slugEfectivo).then((resultado) => {
      if (!cancelado) setBranding(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  // No navegamos acá tras un login exitoso: el guard global en
  // app/providers.tsx ya redirige de forma reactiva (a /cambiar-password,
  // a ?redirect=, o a /agenda) apenas cambia el estado de auth en el store.
  // Hacerlo también acá era lógica duplicada compitiendo con esa —
  // handleLogin leía debeCambiarPassword con el valor de ANTES de loguearse
  // (closure del render que armó este handler, no el que el login recién
  // seteó), así que ocasionalmente tomaba la rama equivocada según el
  // timing de la respuesta del servidor.
  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    clearError();
    await login(email.trim().toLowerCase(), password);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && password && !loading) {
      handleLogin();
    }
  };

  // Superficie/borde/sombra vienen de la paleta cálida del rediseño
  // (agendaColors); el color de foco es el rosa de marca global (colors),
  // no el ag-primary del rediseño — ver nota de integración de color primario.
  const fieldStyle = (field: 'email' | 'password') => ({
    display: 'flex',
    alignItems: 'center',
    height: 54,
    backgroundColor: agendaColors.surface,
    border: `1px solid ${focusedField === field ? colors.primary : agendaColors.border}`,
    boxShadow: focusedField === field ? `0 0 0 3px ${withAlpha(colors.primary, '33')}` : agendaShadows.card,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  });

  return (
    <div
      className={resolvedTheme === 'dark' ? 'agenda-dark' : 'agenda-light'}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: agendaColors.bg }}
    >

      {/* ===== LOGO DEL NEGOCIO =====
          Con logo: NO metemos la imagen en una caja de alto fijo — cada
          negocio sube un logo con una proporción distinta (cuadrado,
          apaisado, con texto abajo), así que cualquier alto fijo con
          "contain" deja franjas del color de fondo alrededor que no pegan
          con el fondo propio de la imagen (pasaba en la captura: marco
          bordó alrededor de un logo con fondo crema). Ancho 100% + alto
          automático = el logo define su propia altura, sin recortes y sin
          márgenes de color, para la mayoría de las proporciones. Techo de
          altura (LOGO_MAX_HEIGHT) para el caso raro de un logo muy angosto/
          vertical: a partir de ahí escala por alto en vez de por ancho
          (maxWidth+maxHeight con width/height auto deja que el navegador
          elija la restricción más chica) para que el formulario nunca
          quede empujado fuera de la pantalla. Sin logo (o mientras
          resuelve, o sin slug) cae al placeholder genérico en una franja de
          alto fijo — mismo lenguaje visual que WelcomeScreen. */}
      {branding?.logo_url ? (
        <div style={{ width: '100%', flexShrink: 0, backgroundColor: agendaColors.primarySoft, display: 'flex', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- proporción intrínseca real de la imagen, que next/image no expone sin declararla de antemano (y no la conocemos: la sube cada negocio). */}
          <img
            src={branding.logo_url}
            alt={branding.nombre}
            style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: LOGO_MAX_HEIGHT }}
          />
        </div>
      ) : (
        <div style={{ height: 220, width: '100%', flexShrink: 0, backgroundColor: agendaColors.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Store size={40} color={colors.primary} strokeWidth={1.5} />
        </div>
      )}

      {/* ===== PANEL DE FORMULARIO ===== */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: -28, flex: 1, borderRadius: '28px 28px 0 0', backgroundColor: agendaColors.bg, padding: '32px 28px 36px' }}>
        <div style={{ margin: '0 auto', width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column' }}>

          <h2 style={{ fontFamily: agendaFontSerif, fontSize: 26, fontWeight: 700, color: agendaColors.strong, margin: 0 }}>{t('welcomeTitle')}</h2>
          <p style={{ marginTop: 4, fontSize: 14, lineHeight: 1.4, color: agendaColors.sub }}>{t('welcomeSubtitle')}</p>

          {/* Error */}
          {error && (
            <div role="alert" style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, backgroundColor: agendaColors.dangerBg, borderLeft: `4px solid ${agendaColors.dangerBorder}` }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: agendaColors.danger, margin: 0 }}>{error}</p>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="email" style={{ fontSize: 13, fontWeight: 600, color: agendaColors.strong }}>{t('emailLabel')}</label>
              <div style={fieldStyle('email')}>
                <Mail size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: agendaColors.text }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="password" style={{ fontSize: 13, fontWeight: 600, color: agendaColors.strong }}>{t('passwordLabel')}</label>
              <div style={fieldStyle('password')}>
                <Lock size={18} color={withAlpha(colors.primary, 'aa')} style={{ flexShrink: 0 }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="current-password"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: agendaColors.text }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: agendaColors.muted }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Olvidé contraseña */}
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontSize: 13, fontWeight: 600, padding: 0 }}
              >
                {t('forgotPassword')}
              </button>
            </div>

            {/* Botón Ingresar — el rosa de marca global, no el ag-primary
                del rediseño (que en modo claro es un tono más saturado):
                el color primario se mantiene integrado con el resto de la app. */}
            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              style={{
                height: 54,
                borderRadius: 16,
                backgroundColor: loading || !email || !password ? colors.primaryDisabled : colors.primary,
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                border: 'none',
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                boxShadow: loading || !email || !password ? 'none' : `0 10px 24px ${withAlpha(colors.primaryDeep, '3d')}`,
                transition: 'background-color 0.2s, box-shadow 0.2s',
              }}
            >
              {loading ? t('submitting') : t('submit')}
            </button>
          </div>

          {/* Footer legal */}
          <button
            onClick={() => router.push('/legal')}
            style={{ alignSelf: 'center', marginTop: 28, background: 'none', border: 'none', cursor: 'pointer', color: agendaColors.sub, fontSize: 12, padding: 8 }}
          >
            {t('terms')}
          </button>
        </div>
      </div>
    </div>
  );
}
